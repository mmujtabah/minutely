package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type MeetingStatus string

const (
	MeetingStatusScheduled  MeetingStatus = "scheduled"
	MeetingStatusInProgress MeetingStatus = "in_progress"
	MeetingStatusCompleted  MeetingStatus = "completed"
	MeetingStatusCanceled   MeetingStatus = "canceled"
)

// Meeting represents a video conference meeting
type Meeting struct {
	ID           uuid.UUID     `json:"id"`
	UserID       *uuid.UUID    `json:"user_id"` // Host
	TeamID       *uuid.UUID    `json:"team_id"`
	Title        string        `json:"title"`
	Description  *string       `json:"description"`
	Status       MeetingStatus `json:"status"`
	ScheduledFor *time.Time    `json:"scheduled_for"`
	IsArchived   bool          `json:"is_archived"`
	CreatedAt    time.Time     `json:"created_at"`
	UpdatedAt    time.Time     `json:"updated_at"`
}

type MeetingSummary struct {
	Meeting
	DurationSecs     *float64 `json:"duration_secs"`
	SpeakerCount     *int     `json:"speaker_count"`
	TranscriptStatus *string  `json:"transcript_status"`
	SummarySnippet   *string  `json:"summary_snippet"`
	OpenActionItems  int      `json:"open_action_items"`
	Source           *string  `json:"source"` // "live" | "upload"
}

// MeetingRepository defines datastore interactions for meetings
type MeetingRepository interface {
	Create(ctx context.Context, meeting *Meeting) error
	GetByID(ctx context.Context, id uuid.UUID) (*Meeting, error)
	ListByUser(ctx context.Context, userID uuid.UUID) ([]*Meeting, error)
	ListSummaries(ctx context.Context, userID uuid.UUID) ([]*MeetingSummary, error)
	Update(ctx context.Context, meeting *Meeting) error
	GetDashboardStats(ctx context.Context, userID uuid.UUID) (*DashboardStats, error)
}

// MeetingService defines business logic for meetings
type MeetingService interface {
	CreateMeeting(ctx context.Context, meeting *Meeting) error
	GetMeeting(ctx context.Context, id uuid.UUID) (*Meeting, error)
	ListUserMeetings(ctx context.Context, userID uuid.UUID) ([]*Meeting, error)
	ListMeetingSummaries(ctx context.Context, userID uuid.UUID) ([]*MeetingSummary, error)
	GetDashboardStats(ctx context.Context, userID uuid.UUID) (*DashboardStats, error)
}
