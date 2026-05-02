package services

import (
	"context"

	"github.com/google/uuid"
	"github.com/MinutelyAI/minutely-api/internal/core/domain"
)

type meetingService struct {
	repo domain.MeetingRepository
}

func NewMeetingService(repo domain.MeetingRepository) domain.MeetingService {
	return &meetingService{repo: repo}
}

func (s *meetingService) CreateMeeting(ctx context.Context, meeting *domain.Meeting) error {
	return s.repo.Create(ctx, meeting)
}

func (s *meetingService) GetMeeting(ctx context.Context, id uuid.UUID) (*domain.Meeting, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *meetingService) ListUserMeetings(ctx context.Context, userID uuid.UUID) ([]*domain.Meeting, error) {
	return s.repo.ListByUser(ctx, userID)
}

func (s *meetingService) GetDashboardStats(ctx context.Context, userID uuid.UUID) (*domain.DashboardStats, error) {
	return s.repo.GetDashboardStats(ctx, userID)
}

func (s *meetingService) ListMeetingSummaries(ctx context.Context, userID uuid.UUID) ([]*domain.MeetingSummary, error) {
	return s.repo.ListSummaries(ctx, userID)
}
