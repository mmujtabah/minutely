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

type supabaseTranscriptRepo struct {
	client *supabase.Client
}

func NewSupabaseTranscriptRepo(client *supabase.Client) domain.TranscriptRepository {
	return &supabaseTranscriptRepo{client: client}
}

func (r *supabaseTranscriptRepo) Create(ctx context.Context, transcript *domain.Transcript) error {
	if transcript.ID == uuid.Nil {
		transcript.ID = uuid.New()
	}

	data, _, err := r.client.From("transcripts").Insert(transcript, false, "exact", "representation", "id").Execute()
	if err != nil {
		return err
	}

	if len(data) > 0 {
		var created []domain.Transcript
		if err := json.Unmarshal(data, &created); err == nil && len(created) > 0 {
			*transcript = created[0]
		}
	}

	return nil
}

func (r *supabaseTranscriptRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Transcript, error) {
	data, _, err := r.client.From("transcripts").Select("*", "exact", false).Eq("id", id.String()).Single().Execute()
	if err != nil {
		return nil, err
	}

	if len(data) == 0 {
		return nil, errors.New("transcript not found")
	}

	var transcript domain.Transcript
	if err := json.Unmarshal(data, &transcript); err != nil {
		return nil, err
	}

	return &transcript, nil
}

func (r *supabaseTranscriptRepo) GetByMeetingID(ctx context.Context, meetingID uuid.UUID) (*domain.Transcript, error) {
	data, _, err := r.client.From("transcripts").Select("*", "exact", false).Eq("meeting_id", meetingID.String()).Order("created_at", &postgrest.OrderOpts{Ascending: false}).Limit(1, "").Single().Execute()
	if err != nil {
		return nil, err
	}

	if len(data) == 0 {
		return nil, errors.New("transcript not found")
	}

	var transcript domain.Transcript
	if err := json.Unmarshal(data, &transcript); err != nil {
		return nil, err
	}

	return &transcript, nil
}

func (r *supabaseTranscriptRepo) Update(ctx context.Context, transcript *domain.Transcript) error {
	_, _, err := r.client.From("transcripts").Update(transcript, "exact", "id").Eq("id", transcript.ID.String()).Execute()
	return err
}

func (r *supabaseTranscriptRepo) CreateSegment(ctx context.Context, segment *domain.TranscriptSegment) error {
	if segment.ID == uuid.Nil {
		segment.ID = uuid.New()
	}

	data, _, err := r.client.From("transcript_segments").Insert(segment, false, "exact", "representation", "id").Execute()
	if err != nil {
		return err
	}

	if len(data) > 0 {
		var created []domain.TranscriptSegment
		if err := json.Unmarshal(data, &created); err == nil && len(created) > 0 {
			*segment = created[0]
		}
	}

	return nil
}

func (r *supabaseTranscriptRepo) CreateSegmentsBatch(ctx context.Context, segments []*domain.TranscriptSegment) error {
	if len(segments) == 0 {
		return nil
	}

	for _, s := range segments {
		if s.ID == uuid.Nil {
			s.ID = uuid.New()
		}
	}

	_, _, err := r.client.From("transcript_segments").Insert(segments, false, "exact", "representation", "id").Execute()
	return err
}

func (r *supabaseTranscriptRepo) ListSegments(ctx context.Context, transcriptID uuid.UUID) ([]*domain.TranscriptSegment, error) {
	data, _, err := r.client.From("transcript_segments").Select("*", "exact", false).Eq("transcript_id", transcriptID.String()).Order("start_secs", &postgrest.OrderOpts{Ascending: true}).Execute()
	if err != nil {
		return nil, err
	}

	var segments []*domain.TranscriptSegment
	if err := json.Unmarshal(data, &segments); err != nil {
		return nil, err
	}

	return segments, nil
}

func (r *supabaseTranscriptRepo) CreateLiveSession(ctx context.Context, session *domain.LiveSession) error {
	if session.ID == uuid.Nil {
		session.ID = uuid.New()
	}

	data, _, err := r.client.From("live_sessions").Insert(session, false, "exact", "representation", "id").Execute()
	if err != nil {
		return err
	}

	if len(data) > 0 {
		var created []domain.LiveSession
		if err := json.Unmarshal(data, &created); err == nil && len(created) > 0 {
			*session = created[0]
		}
	}

	return nil
}

func (r *supabaseTranscriptRepo) GetLiveSessionByMeetingID(ctx context.Context, meetingID uuid.UUID) (*domain.LiveSession, error) {
	data, _, err := r.client.From("live_sessions").Select("*", "exact", false).Eq("meeting_id", meetingID.String()).Filter("ended_at", "is", "null").Order("started_at", &postgrest.OrderOpts{Ascending: false}).Limit(1, "").Single().Execute()
	if err != nil {
		return nil, err
	}

	if len(data) == 0 {
		return nil, errors.New("live session not found")
	}

	var session domain.LiveSession
	if err := json.Unmarshal(data, &session); err != nil {
		return nil, err
	}

	return &session, nil
}

func (r *supabaseTranscriptRepo) UpdateLiveSession(ctx context.Context, session *domain.LiveSession) error {
	_, _, err := r.client.From("live_sessions").Update(session, "exact", "id").Eq("id", session.ID.String()).Execute()
	return err
}
