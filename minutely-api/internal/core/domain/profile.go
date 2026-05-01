package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// Profile represents a user's public profile extending auth.users
type Profile struct {
	ID        uuid.UUID `json:"id"`
	FullName  *string   `json:"full_name"`
	AvatarURL *string   `json:"avatar_url"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ProfileRepository defines datastore interactions for profiles
type ProfileRepository interface {
	GetByID(ctx context.Context, id uuid.UUID) (*Profile, error)
	Update(ctx context.Context, profile *Profile) error
}

// ProfileService defines business logic for profiles
type ProfileService interface {
	GetProfile(ctx context.Context, id uuid.UUID) (*Profile, error)
	UpdateProfile(ctx context.Context, profile *Profile) error
}
