package http

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/MinutelyAI/minutely-api/internal/core/domain"
	"github.com/MinutelyAI/minutely-api/internal/transport/http/middleware"
)

// TranscriptionHandler handles all transcription-related HTTP endpoints
type TranscriptionHandler struct {
	transcriptRepo domain.TranscriptRepository
	jobRepo        domain.JobRepository
	storage        domain.StorageService
	meetingService domain.MeetingService
	storageBucket  string
}

func NewTranscriptionHandler(
	transcriptRepo domain.TranscriptRepository,
	jobRepo domain.JobRepository,
	storage domain.StorageService,
	meetingService domain.MeetingService,
	storageBucket string,
) *TranscriptionHandler {
	return &TranscriptionHandler{
		transcriptRepo: transcriptRepo,
		jobRepo:        jobRepo,
		storage:        storage,
		meetingService: meetingService,
		storageBucket:  storageBucket,
	}
}

func (h *TranscriptionHandler) parseOrGenerateMeetingID(r *http.Request) uuid.UUID {
	meetingIDStr := chi.URLParam(r, "meetingId")
	meetingID, err := uuid.Parse(meetingIDStr)
	if err != nil {
		meetingID = uuid.NewMD5(uuid.NameSpaceURL, []byte(meetingIDStr))
		
		// Try to extract userID from context (if route is authenticated)
		var userIDPtr *uuid.UUID
		if val := r.Context().Value(middleware.UserIDKey); val != nil {
			if uid, ok := val.(uuid.UUID); ok {
				userIDPtr = &uid
			}
		}

		_, _ = h.meetingService.GetMeeting(r.Context(), meetingID)
		err = h.meetingService.CreateMeeting(r.Context(), &domain.Meeting{
			ID:        meetingID,
			UserID:    userIDPtr,
			Title:     meetingIDStr,
			Status:    domain.MeetingStatusInProgress,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		})
		if err != nil {
			fmt.Printf("Warning: failed to create dummy meeting: %v\n", err)
		}
	}
	return meetingID
}

// UploadRecording accepts a multipart file upload, stores it, and enqueues a transcription job.
// POST /api/v1/meetings/{meetingId}/recordings/upload
func (h *TranscriptionHandler) UploadRecording(w http.ResponseWriter, r *http.Request) {
	// Safely get UserID
	var userID uuid.UUID
	if val := r.Context().Value(middleware.UserIDKey); val != nil {
		userID = val.(uuid.UUID)
	}

	meetingID := h.parseOrGenerateMeetingID(r)

	// Max 2GB upload
	r.Body = http.MaxBytesReader(w, r.Body, 2<<30)
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		jsonError(w, "failed to parse multipart form", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		jsonError(w, "file field is required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	language := r.FormValue("language")
	if language == "" {
		language = "en"
	}

	// Build storage path: meetings/{meetingId}/recordings/{uuid}_{filename}
	fileID := uuid.New()
	storagePath := fmt.Sprintf("meetings/%s/recordings/%s_%s", meetingID, fileID, header.Filename)
	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	// Upload to Supabase Storage
	uploadedPath, err := h.storage.UploadFile(r.Context(), h.storageBucket, storagePath, file, contentType)
	if err != nil {
		jsonError(w, "failed to upload file: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Create media_file record
	size := header.Size
	mediaFile := &domain.MediaFile{
		MeetingID:    meetingID,
		StoragePath:  uploadedPath,
		OriginalName: header.Filename,
		MimeType:     contentType,
		SizeBytes:    &size,
		Status:       domain.MediaStatusUploaded,
	}

	if userID != uuid.Nil {
		mediaFile.UploadedBy = &userID
	}

	if err := h.jobRepo.CreateMediaFile(r.Context(), mediaFile); err != nil {
		jsonError(w, "failed to record media file: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Create processing job
	job := &domain.ProcessingJob{
		MeetingID:   meetingID,
		JobType:     domain.JobTypeFileTranscription,
		Status:      domain.JobStatusPending,
		MaxAttempts: 3,
		Payload: map[string]string{
			"media_file_id": mediaFile.ID.String(),
			"language":      language,
		},
	}
	if err := h.jobRepo.CreateJob(r.Context(), job); err != nil {
		jsonError(w, "failed to enqueue job: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Update media file to link back to job
	mediaFile.JobID = &job.ID
	_ = h.jobRepo.UpdateMediaFile(r.Context(), mediaFile)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"file_id": mediaFile.ID,
		"job_id":  job.ID,
		"status":  job.Status,
	})
}

// GetJobStatus returns the current status of a processing job.
// GET /api/v1/jobs/{jobId}
func (h *TranscriptionHandler) GetJobStatus(w http.ResponseWriter, r *http.Request) {
	jobIDStr := chi.URLParam(r, "jobId")
	jobID, err := uuid.Parse(jobIDStr)
	if err != nil {
		jsonError(w, "invalid job id", http.StatusBadRequest)
		return
	}

	job, err := h.jobRepo.GetJobByID(r.Context(), jobID)
	if err != nil {
		jsonError(w, "job not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"job_id":       job.ID,
		"status":       job.Status,
		"attempt":      job.AttemptCount,
		"error":        job.ErrorMessage,
		"started_at":   job.StartedAt,
		"completed_at": job.CompletedAt,
		"result":       job.Result,
	})
}

// GetJobProgress streams SSE progress events for a job.
// GET /api/v1/jobs/{jobId}/progress
func (h *TranscriptionHandler) GetJobProgress(w http.ResponseWriter, r *http.Request) {
	jobIDStr := chi.URLParam(r, "jobId")
	jobID, err := uuid.Parse(jobIDStr)
	if err != nil {
		jsonError(w, "invalid job id", http.StatusBadRequest)
		return
	}

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		jsonError(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
			job, err := h.jobRepo.GetJobByID(r.Context(), jobID)
			if err != nil {
				fmt.Fprintf(w, "data: {\"error\": \"job not found\"}\n\n")
				flusher.Flush()
				return
			}

			eventData, _ := json.Marshal(map[string]interface{}{
				"status":       job.Status,
				"attempt":      job.AttemptCount,
				"error":        job.ErrorMessage,
				"completed_at": job.CompletedAt,
				"result":       job.Result,
			})
			fmt.Fprintf(w, "data: %s\n\n", eventData)
			flusher.Flush()

			// Stop streaming once job is done
			if job.Status == domain.JobStatusCompleted || job.Status == domain.JobStatusFailed {
				return
			}
		}
	}
}

// GetMeetingTranscript returns the full transcript JSON for a meeting.
// GET /api/v1/meetings/{meetingId}/transcript
func (h *TranscriptionHandler) GetMeetingTranscript(w http.ResponseWriter, r *http.Request) {
	meetingID := h.parseOrGenerateMeetingID(r)

	transcript, err := h.transcriptRepo.GetByMeetingID(r.Context(), meetingID)
	if err != nil {
		jsonError(w, "transcript not found", http.StatusNotFound)
		return
	}

	segments, err := h.transcriptRepo.ListSegments(r.Context(), transcript.ID)
	if err != nil {
		jsonError(w, "failed to fetch segments: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Build unique participant list
	participants := []string{}
	seen := map[string]bool{}
	for _, seg := range segments {
		if !seen[seg.SpeakerEmail] {
			participants = append(participants, seg.SpeakerName+" <"+seg.SpeakerEmail+">")
			seen[seg.SpeakerEmail] = true
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"transcript_id": transcript.ID,
		"meeting_id":    transcript.MeetingID,
		"source":        transcript.Source,
		"language":      transcript.Language,
		"duration_secs": transcript.DurationSecs,
		"speaker_count": transcript.SpeakerCount,
		"full_text":     transcript.FullText,
		"segments":      segments,
		"participants":  participants,
		"status":        transcript.Status,
		"completed_at":  transcript.CompletedAt,
	})
}

// jsonError writes a standard JSON error response
func jsonError(w http.ResponseWriter, msg string, code int) {
	fmt.Printf("API ERROR (HTTP %d): %s\n", code, msg)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
