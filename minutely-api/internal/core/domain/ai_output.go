package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type AIOutputType string

const (
	AIOutputTypeSummary     AIOutputType = "summary"
	AIOutputTypeActionItems AIOutputType = "action_items"
	AIOutputTypeKeyTopics   AIOutputType = "key_topics"
	AIOutputTypeSentiment   AIOutputType = "sentiment"
	AIOutputTypeTasks       AIOutputType = "tasks"
	AIOutputTypeCustom      AIOutputType = "custom"
)

type AIOutputStatus string

const (
	AIOutputStatusPending    AIOutputStatus = "pending"
	AIOutputStatusProcessing AIOutputStatus = "processing"
	AIOutputStatusCompleted  AIOutputStatus = "completed"
	AIOutputStatusFailed     AIOutputStatus = "failed"
)

// AIOutput represents the result of an LLM pipeline execution
type AIOutput struct {
	ID            uuid.UUID        `json:"id"`
	MeetingID     uuid.UUID        `json:"meeting_id"`
	TranscriptID  *uuid.UUID       `json:"transcript_id"`
	OutputType    AIOutputType     `json:"output_type"`
	Status        AIOutputStatus   `json:"status"`
	ModelUsed     *string          `json:"model_used"`
	PromptVersion *string          `json:"prompt_version"`
	Result        interface{}      `json:"result"` // Mapped to jsonb
	TokensUsed    *int             `json:"tokens_used"`
	CostUSD       *float64         `json:"cost_usd"`
	ErrorMessage  *string          `json:"error_message"`
	CreatedAt     time.Time        `json:"created_at"`
	CompletedAt   *time.Time       `json:"completed_at"`
}

// AIEvent is emitted when a transcript completes successfully
type AIEvent struct {
	MeetingID    uuid.UUID            `json:"meeting_id"`
	TranscriptID uuid.UUID            `json:"transcript_id"`
	Segments     []*TranscriptSegment `json:"segments"`
	FullText     string               `json:"full_text"`
	Participants []string             `json:"participants"`
	DurationSecs float64              `json:"duration_secs"`
	Source       string               `json:"source"` // "live" or "upload"
}

// AIProcessor is the single integration hook for all future LLM functionality
type AIProcessor interface {
	// ProcessTranscript is called after transcription completes.
	// Should return error only for infrastructure failures, not LLM context failures.
	ProcessTranscript(ctx context.Context, event AIEvent) error
}

// NoopAIProcessor is a stub implementation until the LLM pipeline is built
type NoopAIProcessor struct{}

func (n *NoopAIProcessor) ProcessTranscript(ctx context.Context, event AIEvent) error {
	// For now, this does nothing but satisfy the interface.
	// Later, it will insert 'pending' AIOutput rows and trigger jobs.
	return nil
}

// AIOutputRepository defines datastore interactions for AI results
type AIOutputRepository interface {
	Create(ctx context.Context, output *AIOutput) error
	GetByID(ctx context.Context, id uuid.UUID) (*AIOutput, error)
	ListByMeetingID(ctx context.Context, meetingID uuid.UUID) ([]*AIOutput, error)
	Update(ctx context.Context, output *AIOutput) error
}
