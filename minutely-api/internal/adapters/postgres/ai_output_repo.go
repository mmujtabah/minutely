package postgres

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	postgrest "github.com/supabase-community/postgrest-go"
	"github.com/supabase-community/supabase-go"

	"github.com/MinutelyAI/minutely-api/internal/core/domain"
)

type supabaseAIOutputRepo struct {
	client *supabase.Client
}

func NewSupabaseAIOutputRepo(client *supabase.Client) domain.AIOutputRepository {
	return &supabaseAIOutputRepo{client: client}
}

func (r *supabaseAIOutputRepo) Create(ctx context.Context, output *domain.AIOutput) error {
	if output.ID == uuid.Nil {
		output.ID = uuid.New()
	}

	data, _, err := r.client.From("ai_outputs").Insert(output, false, "exact", "representation", "id").Execute()
	if err != nil {
		return err
	}

	if len(data) > 0 {
		var created []domain.AIOutput
		if err := json.Unmarshal(data, &created); err == nil && len(created) > 0 {
			*output = created[0]
		}
	}

	return nil
}

func (r *supabaseAIOutputRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.AIOutput, error) {
	data, _, err := r.client.From("ai_outputs").Select("*", "exact", false).Eq("id", id.String()).Single().Execute()
	if err != nil {
		return nil, err
	}

	if len(data) == 0 {
		return nil, errors.New("ai output not found")
	}

	var output domain.AIOutput
	if err := json.Unmarshal(data, &output); err != nil {
		return nil, err
	}

	return &output, nil
}

func (r *supabaseAIOutputRepo) ListByMeetingID(ctx context.Context, meetingID uuid.UUID) ([]*domain.AIOutput, error) {
	data, _, err := r.client.From("ai_outputs").Select("*", "exact", false).Eq("meeting_id", meetingID.String()).Order("created_at", &postgrest.OrderOpts{Ascending: false}).Execute()
	if err != nil {
		return nil, err
	}

	var outputs []*domain.AIOutput
	if err := json.Unmarshal(data, &outputs); err != nil {
		return nil, err
	}

	return outputs, nil
}

func (r *supabaseAIOutputRepo) Update(ctx context.Context, output *domain.AIOutput) error {
	_, _, err := r.client.From("ai_outputs").Update(output, "exact", "id").Eq("id", output.ID.String()).Execute()
	return err
}
