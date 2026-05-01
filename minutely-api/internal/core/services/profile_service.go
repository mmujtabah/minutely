package services

import (
	"context"

	"github.com/google/uuid"
	"github.com/MinutelyAI/minutely-api/internal/core/domain"
)

type profileService struct {
	repo domain.ProfileRepository
}

func NewProfileService(repo domain.ProfileRepository) domain.ProfileService {
	return &profileService{repo: repo}
}

func (s *profileService) GetProfile(ctx context.Context, id uuid.UUID) (*domain.Profile, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *profileService) UpdateProfile(ctx context.Context, profile *domain.Profile) error {
	return s.repo.Update(ctx, profile)
}
