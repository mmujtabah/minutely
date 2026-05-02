package postgres

import (
	"context"
	"sync"

	"github.com/google/uuid"
	"github.com/MinutelyAI/minutely-api/internal/core/domain"
)

type dummyProfileRepo struct{}

func NewDummyProfileRepo() domain.ProfileRepository {
	return &dummyProfileRepo{}
}

func (r *dummyProfileRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Profile, error) {
	name := "John Doe"
	return &domain.Profile{ID: id, FullName: &name}, nil
}

func (r *dummyProfileRepo) Update(ctx context.Context, profile *domain.Profile) error {
	return nil
}

type dummyMeetingRepo struct {
	mu       sync.Mutex
	meetings []*domain.Meeting
}

func NewDummyMeetingRepo() domain.MeetingRepository {
	return &dummyMeetingRepo{}
}

func (r *dummyMeetingRepo) Create(ctx context.Context, meeting *domain.Meeting) error {
	meeting.ID = uuid.New()
	return nil
}

func (r *dummyMeetingRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Meeting, error) {
	return &domain.Meeting{ID: id, Title: "Standup"}, nil
}

func (r *dummyMeetingRepo) ListByUser(ctx context.Context, userID uuid.UUID) ([]*domain.Meeting, error) {
	return []*domain.Meeting{}, nil
}

func (r *dummyMeetingRepo) Update(ctx context.Context, meeting *domain.Meeting) error {
	return nil
}

func (r *dummyMeetingRepo) GetDashboardStats(ctx context.Context, userID uuid.UUID) (*domain.DashboardStats, error) {
	return &domain.DashboardStats{
		TotalMeetings:    0,
		HoursTranscribed: 0,
		OpenActionItems:  0,
		PeopleMet:        0,
	}, nil
}

func (r *dummyMeetingRepo) ListSummaries(ctx context.Context, userID uuid.UUID) ([]*domain.MeetingSummary, error) {
	return []*domain.MeetingSummary{}, nil
}
