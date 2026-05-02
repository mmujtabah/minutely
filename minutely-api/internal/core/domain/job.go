package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type JobType string

const (
	JobTypeLiveTranscription JobType = "live_transcription"
	JobTypeFileTranscription JobType = "file_transcription"
	JobTypeAIProcessing      JobType = "ai_processing"
)

type JobStatus string

const (
	JobStatusPending    JobStatus = "pending"
	JobStatusProcessing JobStatus = "processing"
	JobStatusCompleted  JobStatus = "completed"
	JobStatusFailed     JobStatus = "failed"
	JobStatusRetrying   JobStatus = "retrying"
)

type MediaStatus string

const (
	MediaStatusUploaded   MediaStatus = "uploaded"
	MediaStatusProcessing MediaStatus = "processing"
	MediaStatusReady      MediaStatus = "ready"
	MediaStatusError      MediaStatus = "error"
)

// ProcessingJob represents an async background task
type ProcessingJob struct {
	ID           uuid.UUID   `json:"id"`
	MeetingID    uuid.UUID   `json:"meeting_id"`
	JobType      JobType     `json:"job_type"`
	Status       JobStatus   `json:"status"`
	AttemptCount int         `json:"attempt_count"`
	MaxAttempts  int         `json:"max_attempts"`
	ErrorMessage *string     `json:"error_message"`
	Payload      interface{} `json:"payload"` // Typically mapped to map[string]interface{}
	Result       interface{} `json:"result"`
	StartedAt    *time.Time  `json:"started_at"`
	CompletedAt  *time.Time  `json:"completed_at"`
	CreatedAt    time.Time   `json:"created_at"`
	UpdatedAt    time.Time   `json:"updated_at"`
}

// MediaFile represents an uploaded recording
type MediaFile struct {
	ID           uuid.UUID   `json:"id"`
	MeetingID    uuid.UUID   `json:"meeting_id"`
	UploadedBy   *uuid.UUID  `json:"uploaded_by"`
	StoragePath  string      `json:"storage_path"`
	OriginalName string      `json:"original_name"`
	MimeType     string      `json:"mime_type"`
	SizeBytes    *int64      `json:"size_bytes"`
	DurationSecs *float64    `json:"duration_secs"`
	Status       MediaStatus `json:"status"`
	JobID        *uuid.UUID  `json:"job_id"`
	CreatedAt    time.Time   `json:"created_at"`
}

// JobRepository defines datastore interactions for jobs
type JobRepository interface {
	CreateJob(ctx context.Context, job *ProcessingJob) error
	GetJobByID(ctx context.Context, id uuid.UUID) (*ProcessingJob, error)
	UpdateJob(ctx context.Context, job *ProcessingJob) error
	ListPendingJobs(ctx context.Context, jobType JobType, limit int) ([]*ProcessingJob, error)
	
	CreateMediaFile(ctx context.Context, media *MediaFile) error
	GetMediaFileByID(ctx context.Context, id uuid.UUID) (*MediaFile, error)
	UpdateMediaFile(ctx context.Context, media *MediaFile) error
}

// JobService defines business logic for queueing and managing async jobs
type JobService interface {
	EnqueueTranscriptionJob(ctx context.Context, meetingID uuid.UUID, mediaFileID uuid.UUID) (*ProcessingJob, error)
	GetJobStatus(ctx context.Context, jobID uuid.UUID) (*ProcessingJob, error)
	ProcessNextJob(ctx context.Context) error // For worker loop
}
