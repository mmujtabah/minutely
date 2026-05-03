package workers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/google/uuid"

	"github.com/MinutelyAI/minutely-api/internal/adapters/audio"
	"github.com/MinutelyAI/minutely-api/internal/adapters/modal"
	"github.com/MinutelyAI/minutely-api/internal/core/domain"
)

// FileProcessor handles the full lifecycle of an uploaded recording:
// 1. Download from Supabase Storage
// 2. Extract audio via ffmpeg
// 3. Send to Modal (Whisper + pyannote)
// 4. Parse and persist transcript segments
// 5. Fire AI pipeline hook
type FileProcessor struct {
	transcriptRepo domain.TranscriptRepository
	jobRepo        domain.JobRepository
	storage        domain.StorageService
	extractor      audio.AudioExtractor
	modal          modal.Client
	aiProcessor    domain.AIProcessor
	storageBucket  string
	tempDir        string
}

func NewFileProcessor(
	transcriptRepo domain.TranscriptRepository,
	jobRepo domain.JobRepository,
	storage domain.StorageService,
	extractor audio.AudioExtractor,
	modal modal.Client,
	aiProcessor domain.AIProcessor,
	storageBucket string,
	tempDir string,
) *FileProcessor {
	return &FileProcessor{
		transcriptRepo: transcriptRepo,
		jobRepo:        jobRepo,
		storage:        storage,
		extractor:      extractor,
		modal:          modal,
		aiProcessor:    aiProcessor,
		storageBucket:  storageBucket,
		tempDir:        tempDir,
	}
}

// Process executes the full transcription pipeline for a given job
// Process executes the full transcription pipeline for a given job,
// claiming it as 'processing' first. Used for direct calls.
func (p *FileProcessor) Process(ctx context.Context, job *domain.ProcessingJob) error {
	now := time.Now()
	job.Status = domain.JobStatusProcessing
	job.StartedAt = &now
	job.AttemptCount++
	if err := p.jobRepo.UpdateJob(ctx, job); err != nil {
		return fmt.Errorf("failed to mark job processing: %w", err)
	}
	return p.run(ctx, job)
}

// ProcessClaimed executes the pipeline for a job already marked 'processing' by the pool.
// Skips the duplicate status update to avoid a redundant DB write.
func (p *FileProcessor) ProcessClaimed(ctx context.Context, job *domain.ProcessingJob) error {
	return p.run(ctx, job)
}

func (p *FileProcessor) run(ctx context.Context, job *domain.ProcessingJob) error {
	var err error
	if job.JobType == domain.JobTypeAIProcessing {
		err = p.processAIJob(ctx, job)
	} else {
		err = p.processJob(ctx, job)
	}
	if err != nil {
		errMsg := err.Error()
		job.ErrorMessage = &errMsg
		if job.AttemptCount >= job.MaxAttempts {
			job.Status = domain.JobStatusFailed
		} else {
			job.Status = domain.JobStatusRetrying
		}
		_ = p.jobRepo.UpdateJob(ctx, job)
		return err
	}

	completedAt := time.Now()
	job.Status = domain.JobStatusCompleted
	job.CompletedAt = &completedAt
	return p.jobRepo.UpdateJob(ctx, job)
}


func (p *FileProcessor) processJob(ctx context.Context, job *domain.ProcessingJob) error {
	// Parse payload to get media_file_id and language
	payloadBytes, err := json.Marshal(job.Payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}
	var payload struct {
		MediaFileID string `json:"media_file_id"`
		Language    string `json:"language"`
	}
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return fmt.Errorf("failed to parse job payload: %w", err)
	}

	mediaFileID, err := uuid.Parse(payload.MediaFileID)
	if err != nil {
		return fmt.Errorf("invalid media_file_id: %w", err)
	}

	// Load the media file record
	mediaFile, err := p.jobRepo.GetMediaFileByID(ctx, mediaFileID)
	if err != nil {
		return fmt.Errorf("failed to get media file: %w", err)
	}

	// --- STAGE A: Download from Supabase Storage ---
	log.Printf("[job %s] Stage A: Downloading file from storage: %s", job.ID, mediaFile.StoragePath)
	fileReader, err := p.storage.DownloadFile(ctx, p.storageBucket, mediaFile.StoragePath)
	if err != nil {
		return fmt.Errorf("failed to download from storage: %w", err)
	}
	defer fileReader.Close()

	// Write to a temp file on disk so ffmpeg can read it
	if err := os.MkdirAll(p.tempDir, 0755); err != nil {
		return fmt.Errorf("failed to create temp dir: %w", err)
	}
	// Comprehensive MIME → file extension mapping.
	// Correct extensions ensure FFmpeg uses the right demuxer.
	mimeToExt := map[string]string{
		"video/mp4":              ".mp4",
		"video/quicktime":        ".mov",
		"video/x-matroska":       ".mkv",
		"video/webm":             ".webm",
		"video/x-msvideo":        ".avi",
		"audio/mpeg":             ".mp3",
		"audio/wav":              ".wav",
		"audio/x-wav":            ".wav",
		"audio/mp4":              ".m4a",
		"audio/x-m4a":            ".m4a",
		"audio/aac":              ".aac",
		"audio/ogg":              ".ogg",
		"audio/webm":             ".webm",
		"audio/flac":             ".flac",
		"application/octet-stream": ".bin",
	}
	ext, ok := mimeToExt[mediaFile.MimeType]
	if !ok {
		log.Printf("[job %s] Unknown MIME type '%s', defaulting to .bin", job.ID, mediaFile.MimeType)
		ext = ".bin"
	}
	tmpInput := fmt.Sprintf("%s/%s%s", p.tempDir, uuid.New().String(), ext)
	tmpFile, err := os.Create(tmpInput)
	if err != nil {
		return fmt.Errorf("failed to create temp input file: %w", err)
	}
	if _, err := tmpFile.ReadFrom(fileReader); err != nil {
		tmpFile.Close()
		return fmt.Errorf("failed to write temp input file: %w", err)
	}
	tmpFile.Close()
	defer p.extractor.Cleanup(tmpInput)

	// --- STAGE B: Audio Extraction + Preprocessing ---
	// FFmpeg applies: highpass filter (80Hz) → EBU R128 loudnorm → silence removal
	// This significantly improves Whisper transcription accuracy on noisy recordings.
	log.Printf("[job %s] Stage B: Extracting + preprocessing 16kHz WAV audio (MIME: %s)", job.ID, mediaFile.MimeType)
	wavPath, err := p.extractor.ExtractWav16kHz(ctx, tmpInput)
	if err != nil {
		return fmt.Errorf("ffmpeg extraction failed: %w", err)
	}
	defer p.extractor.Cleanup(wavPath)

	// --- STAGE C: Send to Modal for transcription + diarization ---
	log.Printf("[job %s] Stage C: Sending to Modal Whisper endpoint", job.ID)
	result, err := p.modal.TranscribeAudio(ctx, wavPath, payload.Language)
	if err != nil {
		return fmt.Errorf("modal transcription failed: %w", err)
	}

	// --- STAGE D: Persist transcript + segments ---
	log.Printf("[job %s] Stage D: Persisting transcript (%d segments)", job.ID, len(result.Segments))
	source := string(domain.SourceUpload)
	status := domain.TranscriptStatusCompleted
	completedAt := time.Now()

	transcript := &domain.Transcript{
		MeetingID:    job.MeetingID,
		MediaFileID:  &mediaFileID,
		Source:       domain.SourceUpload,
		Language:     result.Language,
		FullText:     &result.Text,
		DurationSecs: &result.Info.DurationSecs,
		SpeakerCount: &result.Info.SpeakerCount,
		Status:       status,
		CompletedAt:  &completedAt,
	}
	_ = source
	if err := p.transcriptRepo.Create(ctx, transcript); err != nil {
		return fmt.Errorf("failed to create transcript: %w", err)
	}

	// Build segments — speaker_name/email from Modal diarization.
	// For uploaded files, speaker identity isn't known from Jitsi so we
	// default to the diarized label. Caller can update later via API.
	segments := make([]*domain.TranscriptSegment, 0, len(result.Segments))
	for i, seg := range result.Segments {
		seqNum := i
		segments = append(segments, &domain.TranscriptSegment{
			TranscriptID: transcript.ID,
			SpeakerLabel: &seg.Speaker,
			SpeakerName:  seg.Speaker, // Resolved by host via frontend later
			SpeakerEmail: "unknown@minutely.ai", // Placeholder for uploads
			Text:         seg.Text,
			StartSecs:    seg.Start,
			EndSecs:      seg.End,
			IsPartial:    false,
			SequenceNum:  &seqNum,
		})
	}

	if err := p.transcriptRepo.CreateSegmentsBatch(ctx, segments); err != nil {
		return fmt.Errorf("failed to persist segments: %w", err)
	}

	// Update media file status
	mediaFile.Status = domain.MediaStatusReady
	if err := p.jobRepo.UpdateMediaFile(ctx, mediaFile); err != nil {
		log.Printf("[job %s] Warning: failed to update media file status: %v", job.ID, err)
	}

	// Store transcript ID in job result
	job.Result = map[string]string{"transcript_id": transcript.ID.String()}
	if err := p.jobRepo.UpdateJob(ctx, job); err != nil {
		log.Printf("[job %s] Warning: failed to store result in job: %v", job.ID, err)
	}

	// --- STAGE E: Fire AI pipeline hook ---
	log.Printf("[job %s] Stage E: Firing AI pipeline hook", job.ID)
	participants := make([]string, 0)
	seen := map[string]bool{}
	for _, seg := range segments {
		if !seen[seg.SpeakerName] {
			participants = append(participants, seg.SpeakerName)
			seen[seg.SpeakerName] = true
		}
	}

	aiEvent := domain.AIEvent{
		MeetingID:    job.MeetingID,
		TranscriptID: transcript.ID,
		Segments:     segments,
		FullText:     result.Text,
		Participants: participants,
		DurationSecs: result.Info.DurationSecs,
		Source:       string(domain.SourceUpload),
	}
	if err := p.aiProcessor.ProcessTranscript(ctx, aiEvent); err != nil {
		// Non-fatal: log but don't fail the job
		log.Printf("[job %s] Warning: AI processor error: %v", job.ID, err)
	}

	log.Printf("[job %s] Completed successfully. Transcript: %s", job.ID, transcript.ID)
	return nil
}

func (p *FileProcessor) processAIJob(ctx context.Context, job *domain.ProcessingJob) error {
	payloadBytes, err := json.Marshal(job.Payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}
	var payload struct {
		TranscriptID string `json:"transcript_id"`
	}
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return fmt.Errorf("failed to parse job payload: %w", err)
	}

	transcriptID, err := uuid.Parse(payload.TranscriptID)
	if err != nil {
		return fmt.Errorf("invalid transcript_id: %w", err)
	}

	// Fetch transcript
	transcript, err := p.transcriptRepo.GetByID(ctx, transcriptID)
	if err != nil {
		return fmt.Errorf("failed to get transcript: %w", err)
	}

	// Fetch segments
	segments, err := p.transcriptRepo.ListSegments(ctx, transcriptID)
	if err != nil {
		return fmt.Errorf("failed to get transcript segments: %w", err)
	}
	log.Printf("[job %s] Found %d segments for transcript %s", job.ID, len(segments), transcriptID)
	if len(segments) == 0 {
		log.Printf("[job %s] No segments found, skipping AI processing", job.ID)
		return nil
	}

	// Build AIEvent
	participants := make([]string, 0)
	seen := map[string]bool{}
	for _, seg := range segments {
		if !seen[seg.SpeakerName] {
			participants = append(participants, seg.SpeakerName)
			seen[seg.SpeakerName] = true
		}
	}

	fullText := ""
	if transcript.FullText != nil && *transcript.FullText != "" {
		fullText = *transcript.FullText
	} else if len(segments) > 0 {
		// Reconstruct from segments if FullText is missing (common for live sessions)
		for i, seg := range segments {
			if i > 0 {
				fullText += " "
			}
			fullText += seg.Text
		}
	}
	
	durationSecs := 0.0
	if transcript.DurationSecs != nil {
		durationSecs = *transcript.DurationSecs
	}

	aiEvent := domain.AIEvent{
		MeetingID:    job.MeetingID,
		TranscriptID: transcriptID,
		Segments:     segments,
		FullText:     fullText,
		Participants: participants,
		DurationSecs: durationSecs,
		Source:       string(transcript.Source),
	}

	// Delegate to AIProcessor implementation (which will hit Python service)
	log.Printf("[job %s] Firing AI pipeline hook for transcript %s", job.ID, transcriptID)
	if err := p.aiProcessor.ProcessTranscript(ctx, aiEvent); err != nil {
		return fmt.Errorf("AI processor failed: %w", err)
	}

	return nil
}
