package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type ActionItemStatus string

const (
	ActionItemStatusOpen      ActionItemStatus = "open"
	ActionItemStatusDone      ActionItemStatus = "done"
	ActionItemStatusDismissed ActionItemStatus = "dismissed"
)

type ActionItem struct {
	ID           uuid.UUID        `json:"id"`
	MeetingID    uuid.UUID        `json:"meeting_id"`
	TranscriptID *uuid.UUID       `json:"transcript_id,omitempty"`
	Task         string           `json:"task"`
	AssigneeName *string          `json:"assignee_name,omitempty"`
	AssigneeID   *uuid.UUID       `json:"assignee_id,omitempty"`
	Status       ActionItemStatus `json:"status"`
	DueDate      *time.Time       `json:"due_date,omitempty"`
	SegmentRef   *uuid.UUID       `json:"segment_ref,omitempty"`
	CreatedAt    time.Time        `json:"created_at"`
	UpdatedAt    time.Time        `json:"updated_at"`
}

type ActionItemRepository interface {
	Create(ctx context.Context, item *ActionItem) error
	GetByID(ctx context.Context, id uuid.UUID) (*ActionItem, error)
	ListByMeetingID(ctx context.Context, meetingID uuid.UUID) ([]*ActionItem, error)
	ListOpenForUser(ctx context.Context, userID uuid.UUID) ([]*ActionItem, error)
	Update(ctx context.Context, item *ActionItem) error
}

type DashboardStats struct {
	TotalMeetings    int     `json:"total_meetings"`
	HoursTranscribed float64 `json:"hours_transcribed"`
	OpenActionItems  int     `json:"open_action_items"`
	PeopleMet        int     `json:"people_met"`
}
