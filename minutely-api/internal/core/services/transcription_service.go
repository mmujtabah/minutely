package services

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/MinutelyAI/minutely-api/internal/adapters/deepgram"
	"github.com/MinutelyAI/minutely-api/internal/core/domain"
)

type transcriptionService struct {
	repo       domain.TranscriptRepository
	jobRepo    domain.JobRepository
	deepgram   deepgram.Client
}

func NewTranscriptionService(repo domain.TranscriptRepository, jobRepo domain.JobRepository, dgClient deepgram.Client) domain.TranscriptionService {
	return &transcriptionService{
		repo:     repo,
		jobRepo:  jobRepo,
		deepgram: dgClient,
	}
}

func (s *transcriptionService) StartLiveSession(ctx context.Context, meetingID uuid.UUID) (*domain.LiveSession, string, error) {
	// 1. Check if an active session already exists
	session, err := s.repo.GetLiveSessionByMeetingID(ctx, meetingID)
	
	// 2. Generate a temporary Deepgram API key (valid for 4 hours)
	tokenExpiresIn := 4 * time.Hour
	tempKey, errDG := s.deepgram.GenerateTempKey(ctx, tokenExpiresIn)
	if errDG != nil {
		return nil, "", fmt.Errorf("failed to generate deepgram key: %w", errDG)
	}

	if err == nil && session != nil {
		// Active session found, just return it with the new key
		return session, tempKey, nil
	}

	// 3. Create the Transcript record
	transcript := &domain.Transcript{
		MeetingID: meetingID,
		Source:    domain.SourceLive,
		Status:    domain.TranscriptStatusInProgress,
	}
	if err := s.repo.Create(ctx, transcript); err != nil {
		return nil, "", fmt.Errorf("failed to create transcript: %w", err)
	}

	// 4. Create the LiveSession record
	expiresAt := time.Now().Add(tokenExpiresIn)
	newSession := &domain.LiveSession{
		MeetingID:            meetingID,
		TranscriptID:         &transcript.ID,
		DeepgramTokenExpires: &expiresAt,
		StartedAt:            time.Now(),
		ParticipantCount:     0,
	}
	if err := s.repo.CreateLiveSession(ctx, newSession); err != nil {
		return nil, "", fmt.Errorf("failed to create live session: %w", err)
	}

	// Return the new session and the temporary key
	return newSession, tempKey, nil
}

func (s *transcriptionService) EndLiveSession(ctx context.Context, meetingID uuid.UUID) error {
	session, err := s.repo.GetLiveSessionByMeetingID(ctx, meetingID)
	if err != nil {
		return fmt.Errorf("no active live session found for meeting: %w", err)
	}

	// Mark session as ended
	now := time.Now()
	session.EndedAt = &now
	if err := s.repo.UpdateLiveSession(ctx, session); err != nil {
		return fmt.Errorf("failed to update live session: %w", err)
	}

	// Mark transcript as completed
	if session.TranscriptID != nil {
		transcript, err := s.repo.GetByID(ctx, *session.TranscriptID)
		if err == nil {
			transcript.Status = domain.TranscriptStatusCompleted
			transcript.CompletedAt = &now
			_ = s.repo.Update(ctx, transcript)
		}
	}

	// Enqueue AI processing job
	if session.TranscriptID != nil {
		job := &domain.ProcessingJob{
			MeetingID:   meetingID,
			JobType:     domain.JobTypeAIProcessing,
			Status:      domain.JobStatusPending,
			MaxAttempts: 3,
			Payload: map[string]string{
				"transcript_id": session.TranscriptID.String(),
			},
		}
		_ = s.jobRepo.CreateJob(ctx, job)
	}

	return nil
}

func (s *transcriptionService) GetMeetingTranscript(ctx context.Context, meetingID uuid.UUID) (*domain.Transcript, []*domain.TranscriptSegment, error) {
	transcript, err := s.repo.GetByMeetingID(ctx, meetingID)
	if err != nil {
		return nil, nil, err
	}

	segments, err := s.repo.ListSegments(ctx, transcript.ID)
	if err != nil {
		return nil, nil, err
	}

	return transcript, segments, nil
}
