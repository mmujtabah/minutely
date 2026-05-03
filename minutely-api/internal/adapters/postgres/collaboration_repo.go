package postgres

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/supabase-community/supabase-go"

	"github.com/MinutelyAI/minutely-api/internal/core/domain"
)

type supabaseCollaborationRepo struct {
	client *supabase.Client
}

func NewSupabaseCollaborationRepo(client *supabase.Client) domain.CollaborationRepository {
	return &supabaseCollaborationRepo{client: client}
}

func (r *supabaseCollaborationRepo) CreateMeetingInvite(ctx context.Context, invite *domain.MeetingInvite) error {
	if invite.ID == uuid.Nil {
		invite.ID = uuid.New()
	}
	data, _, err := r.client.From("meeting_invites").Insert(invite, false, "exact", "representation", "id").Execute()
	if err != nil {
		return err
	}
	if len(data) > 0 {
		var created []domain.MeetingInvite
		if err = json.Unmarshal(data, &created); err == nil && len(created) > 0 {
			*invite = created[0]
		}
	}
	return nil
}

func (r *supabaseCollaborationRepo) ListMeetingInvites(ctx context.Context, meetingID uuid.UUID) ([]*domain.MeetingInvite, error) {
	data, _, err := r.client.From("meeting_invites").Select("*", "exact", false).Eq("meeting_id", meetingID.String()).Order("created_at", nil).Execute()
	if err != nil {
		return nil, err
	}
	var invites []*domain.MeetingInvite
	if err = json.Unmarshal(data, &invites); err != nil {
		return nil, err
	}
	return invites, nil
}

func (r *supabaseCollaborationRepo) CreateTeam(ctx context.Context, team *domain.Team) error {
	if team.ID == uuid.Nil {
		team.ID = uuid.New()
	}
	data, _, err := r.client.From("teams").Insert(team, false, "exact", "representation", "id").Execute()
	if err != nil {
		return err
	}
	if len(data) > 0 {
		var created []domain.Team
		if err = json.Unmarshal(data, &created); err == nil && len(created) > 0 {
			*team = created[0]
		}
	}
	return nil
}

func (r *supabaseCollaborationRepo) ListTeamsByUser(ctx context.Context, userID uuid.UUID) ([]*domain.Team, error) {
	data, _, err := r.client.From("teams").
		Select("id,name,description,created_by,created_at,team_members!inner(user_id)", "exact", false).
		Eq("team_members.user_id", userID.String()).
		Order("created_at", nil).
		Execute()
	if err != nil {
		return nil, err
	}
	var teams []*domain.Team
	if err = json.Unmarshal(data, &teams); err != nil {
		return nil, err
	}
	return teams, nil
}

func (r *supabaseCollaborationRepo) AddTeamMember(ctx context.Context, member *domain.TeamMember) error {
	_, _, err := r.client.From("team_members").Insert(member, false, "exact", "minimal", "").Execute()
	return err
}

func (r *supabaseCollaborationRepo) CreateChannel(ctx context.Context, channel *domain.TeamChannel) error {
	if channel.ID == uuid.Nil {
		channel.ID = uuid.New()
	}
	data, _, err := r.client.From("team_channels").Insert(channel, false, "exact", "representation", "id").Execute()
	if err != nil {
		return err
	}
	if len(data) > 0 {
		var created []domain.TeamChannel
		if err = json.Unmarshal(data, &created); err == nil && len(created) > 0 {
			*channel = created[0]
		}
	}
	return nil
}

func (r *supabaseCollaborationRepo) ListChannelsByTeam(ctx context.Context, teamID uuid.UUID) ([]*domain.TeamChannel, error) {
	data, _, err := r.client.From("team_channels").Select("*", "exact", false).Eq("team_id", teamID.String()).Order("created_at", nil).Execute()
	if err != nil {
		return nil, err
	}
	var channels []*domain.TeamChannel
	if err = json.Unmarshal(data, &channels); err != nil {
		return nil, err
	}
	return channels, nil
}

func (r *supabaseCollaborationRepo) CreateMessage(ctx context.Context, msg *domain.ChatMessage) error {
	if msg.ID == uuid.Nil {
		msg.ID = uuid.New()
	}
	data, _, err := r.client.From("chat_messages").Insert(msg, false, "exact", "representation", "id").Execute()
	if err != nil {
		return err
	}
	if len(data) > 0 {
		var created []domain.ChatMessage
		if err = json.Unmarshal(data, &created); err == nil && len(created) > 0 {
			*msg = created[0]
		}
	}
	return nil
}

func (r *supabaseCollaborationRepo) ListMessages(ctx context.Context, teamID, channelID uuid.UUID, limit int) ([]*domain.ChatMessage, error) {
	if limit <= 0 {
		limit = 50
	}
	data, _, err := r.client.From("chat_messages").
		Select("*", "exact", false).
		Eq("team_id", teamID.String()).
		Eq("channel_id", channelID.String()).
		Order("created_at", nil).
		Limit(limit, "").
		Execute()
	if err != nil {
		return nil, err
	}
	var messages []*domain.ChatMessage
	if err = json.Unmarshal(data, &messages); err != nil {
		return nil, err
	}
	return messages, nil
}
