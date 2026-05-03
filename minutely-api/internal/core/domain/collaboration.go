package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type InviteStatus string

const (
	InviteStatusPending  InviteStatus = "pending"
	InviteStatusSent     InviteStatus = "sent"
	InviteStatusFailed   InviteStatus = "failed"
	InviteStatusAccepted InviteStatus = "accepted"
	InviteStatusDeclined InviteStatus = "declined"
)

type MeetingInvite struct {
	ID           uuid.UUID    `json:"id"`
	MeetingID    uuid.UUID    `json:"meeting_id"`
	InvitedBy    *uuid.UUID   `json:"invited_by,omitempty"`
	InviteeEmail string       `json:"invitee_email"`
	InviteeName  *string      `json:"invitee_name,omitempty"`
	Status       InviteStatus `json:"status"`
	InviteToken  uuid.UUID    `json:"invite_token"`
	SentAt       *time.Time   `json:"sent_at,omitempty"`
	RespondedAt  *time.Time   `json:"responded_at,omitempty"`
	CreatedAt    time.Time    `json:"created_at"`
}

type Team struct {
	ID          uuid.UUID  `json:"id"`
	Name        string     `json:"name"`
	Description *string    `json:"description,omitempty"`
	CreatedBy   *uuid.UUID `json:"created_by,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

type TeamMember struct {
	TeamID   uuid.UUID `json:"team_id"`
	UserID   uuid.UUID `json:"user_id"`
	Role     string    `json:"role"`
	JoinedAt time.Time `json:"joined_at"`
}

type TeamChannel struct {
	ID          uuid.UUID  `json:"id"`
	TeamID      uuid.UUID  `json:"team_id"`
	Name        string     `json:"name"`
	Description *string    `json:"description,omitempty"`
	IsPrivate   bool       `json:"is_private"`
	CreatedBy   *uuid.UUID `json:"created_by,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

type ChatMessage struct {
	ID          uuid.UUID   `json:"id"`
	TeamID      uuid.UUID   `json:"team_id"`
	ChannelID   uuid.UUID   `json:"channel_id"`
	SenderID    *uuid.UUID  `json:"sender_id,omitempty"`
	SenderName  *string     `json:"sender_name,omitempty"`
	SenderEmail *string     `json:"sender_email,omitempty"`
	Body        string      `json:"body"`
	Metadata    interface{} `json:"metadata,omitempty"`
	CreatedAt   time.Time   `json:"created_at"`
	EditedAt    *time.Time  `json:"edited_at,omitempty"`
}

type CollaborationRepository interface {
	CreateMeetingInvite(ctx context.Context, invite *MeetingInvite) error
	ListMeetingInvites(ctx context.Context, meetingID uuid.UUID) ([]*MeetingInvite, error)

	CreateTeam(ctx context.Context, team *Team) error
	ListTeamsByUser(ctx context.Context, userID uuid.UUID) ([]*Team, error)
	AddTeamMember(ctx context.Context, member *TeamMember) error

	CreateChannel(ctx context.Context, channel *TeamChannel) error
	ListChannelsByTeam(ctx context.Context, teamID uuid.UUID) ([]*TeamChannel, error)

	CreateMessage(ctx context.Context, msg *ChatMessage) error
	ListMessages(ctx context.Context, teamID, channelID uuid.UUID, limit int) ([]*ChatMessage, error)
}
