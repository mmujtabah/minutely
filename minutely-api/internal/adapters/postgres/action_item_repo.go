package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/supabase-community/supabase-go"

	"github.com/MinutelyAI/minutely-api/internal/core/domain"
)

type supabaseActionItemRepo struct {
	client *supabase.Client
}

func NewSupabaseActionItemRepo(client *supabase.Client) domain.ActionItemRepository {
	return &supabaseActionItemRepo{client: client}
}

func (r *supabaseActionItemRepo) Create(ctx context.Context, item *domain.ActionItem) error {
	if item.ID == uuid.Nil {
		item.ID = uuid.New()
	}
	// Avoid persisting Go zero-time (0001-01-01) into DB when caller doesn't set timestamps.
	if item.CreatedAt.IsZero() {
		item.CreatedAt = time.Now().UTC()
	}
	if item.UpdatedAt.IsZero() {
		item.UpdatedAt = time.Now().UTC()
	}

	data, _, err := r.client.From("action_items").Insert(item, false, "exact", "representation", "id").Execute()
	if err != nil {
		return err
	}

	if len(data) > 0 {
		var created []domain.ActionItem
		if err := json.Unmarshal(data, &created); err == nil && len(created) > 0 {
			*item = created[0]
		}
	}
	return nil
}

func (r *supabaseActionItemRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.ActionItem, error) {
	data, _, err := r.client.From("action_items").Select("*", "exact", false).Eq("id", id.String()).Single().Execute()
	if err != nil {
		return nil, err
	}

	if len(data) == 0 {
		return nil, errors.New("action item not found")
	}

	var item domain.ActionItem
	if err := json.Unmarshal(data, &item); err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *supabaseActionItemRepo) ListByMeetingID(ctx context.Context, meetingID uuid.UUID) ([]*domain.ActionItem, error) {
	data, _, err := r.client.From("action_items").Select("*", "exact", false).Eq("meeting_id", meetingID.String()).Order("created_at", nil).Execute()
	if err != nil {
		return nil, err
	}

	var items []*domain.ActionItem
	if err := json.Unmarshal(data, &items); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *supabaseActionItemRepo) ListOpenForUser(ctx context.Context, userID uuid.UUID) ([]*domain.ActionItem, error) {
	data, _, err := r.client.From("user_action_items_view").Select("*", "exact", false).
		Eq("meeting_owner_id", userID.String()).
		Eq("status", string(domain.ActionItemStatusOpen)).
		Order("due_date", nil).Execute()
	if err != nil {
		return nil, err
	}

	var items []*domain.ActionItem
	if err := json.Unmarshal(data, &items); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *supabaseActionItemRepo) ListForUser(ctx context.Context, userID uuid.UUID) ([]*domain.ActionItem, error) {
	data, _, err := r.client.From("user_action_items_view").Select("*", "exact", false).
		Eq("meeting_owner_id", userID.String()).
		Order("updated_at", nil).Execute()
	if err != nil {
		return nil, err
	}

	var items []*domain.ActionItem
	if err := json.Unmarshal(data, &items); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *supabaseActionItemRepo) Update(ctx context.Context, item *domain.ActionItem) error {
	_, _, err := r.client.From("action_items").Update(item, "exact", "id").Eq("id", item.ID.String()).Execute()
	return err
}
