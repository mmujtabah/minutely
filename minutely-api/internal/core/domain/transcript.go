package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type TranscriptSource string

const (
	SourceLive   TranscriptSource = "live"
	SourceUpload TranscriptSource = "upload"
)

type TranscriptStatus string

const (
	TranscriptStatusInProgress TranscriptStatus = "in_progress"
	TranscriptStatusCompleted  TranscriptStatus = "completed"
	TranscriptStatusFailed     TranscriptStatus = "failed"
)

// Transcript represents the full transcript of a meeting
type Transcript struct {
	ID           uuid.UUID        `json:"id"`
	MeetingID    uuid.UUID        `json:"meeting_id"`
	MediaFileID  *uuid.UUID       `json:"media_file_id"`
	Source       TranscriptSource `json:"source"`
	Language     string           `json:"language"`
	FullText     *string          `json:"full_text"`
	DurationSecs *float64         `json:"duration_secs"`
	SpeakerCount *int             `json:"speaker_count"`
	Status       TranscriptStatus `json:"status"`
	CreatedAt    time.Time        `json:"created_at"`
	CompletedAt  *time.Time       `json:"completed_at"`
}

// TranscriptSegment represents a diarized speech segment
type TranscriptSegment struct {
	ID           uuid.UUID `json:"id"`
	TranscriptID uuid.UUID `json:"transcript_id"`
	SpeakerLabel *string   `json:"speaker_label"`
	SpeakerName  string    `json:"speaker_name"`
	SpeakerEmail string    `json:"speaker_email"`
	Text         string    `json:"text"`
	StartSecs    float64   `json:"start_secs"`
	EndSecs      float64   `json:"end_secs"`
	Confidence   *float64  `json:"confidence"`
	IsPartial    bool      `json:"is_partial"`
	SequenceNum  *int      `json:"sequence_num"`
	CreatedAt    time.Time `json:"created_at"`
}

// LiveSession represents an active live transcription session
type LiveSession struct {
	ID                   uuid.UUID  `json:"id"`
	MeetingID            uuid.UUID  `json:"meeting_id"`
	TranscriptID         *uuid.UUID `json:"transcript_id"`
	DeepgramTokenExpires *time.Time `json:"deepgram_token_expires"`
	StartedAt            time.Time  `json:"started_at"`
	EndedAt              *time.Time `json:"ended_at"`
	ParticipantCount     int        `json:"participant_count"`
}

// TranscriptRepository defines datastore interactions for transcription
type TranscriptRepository interface {
	Create(ctx context.Context, transcript *Transcript) error
	GetByID(ctx context.Context, id uuid.UUID) (*Transcript, error)
	GetByMeetingID(ctx context.Context, meetingID uuid.UUID) (*Transcript, error)
	Update(ctx context.Context, transcript *Transcript) error

	CreateSegment(ctx context.Context, segment *TranscriptSegment) error
	CreateSegmentsBatch(ctx context.Context, segments []*TranscriptSegment) error
	ListSegments(ctx context.Context, transcriptID uuid.UUID) ([]*TranscriptSegment, error)
	
	CreateLiveSession(ctx context.Context, session *LiveSession) error
	GetLiveSessionByMeetingID(ctx context.Context, meetingID uuid.UUID) (*LiveSession, error)
	UpdateLiveSession(ctx context.Context, session *LiveSession) error
}

// TranscriptionService defines business logic for transcription
type TranscriptionService interface {
	StartLiveSession(ctx context.Context, meetingID uuid.UUID) (*LiveSession, string, error) // returns session and WS url
	EndLiveSession(ctx context.Context, meetingID uuid.UUID) error
	GetMeetingTranscript(ctx context.Context, meetingID uuid.UUID) (*Transcript, []*TranscriptSegment, error)
}
