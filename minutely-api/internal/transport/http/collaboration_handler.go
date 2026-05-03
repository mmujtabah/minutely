package http

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/MinutelyAI/minutely-api/internal/core/domain"
	"github.com/MinutelyAI/minutely-api/internal/transport/http/middleware"
)

type CollaborationHandler struct {
	repo domain.CollaborationRepository
}

func NewCollaborationHandler(repo domain.CollaborationRepository) *CollaborationHandler {
	return &CollaborationHandler{repo: repo}
}

func (h *CollaborationHandler) CreateMeetingInvites(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	meetingID, err := uuid.Parse(chi.URLParam(r, "meetingId"))
	if err != nil {
		jsonError(w, "invalid meeting id", http.StatusBadRequest)
		return
	}

	var payload struct {
		Invites []struct {
			Email string  `json:"email"`
			Name  *string `json:"name"`
		} `json:"invites"`
	}
	if err = json.NewDecoder(r.Body).Decode(&payload); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if len(payload.Invites) == 0 {
		jsonError(w, "invites are required", http.StatusBadRequest)
		return
	}

	created := make([]*domain.MeetingInvite, 0, len(payload.Invites))
	for _, i := range payload.Invites {
		invite := &domain.MeetingInvite{
			MeetingID:    meetingID,
			InvitedBy:    &userID,
			InviteeEmail: i.Email,
			InviteeName:  i.Name,
			Status:       domain.InviteStatusSent,
		}
		now := time.Now()
		invite.SentAt = &now
		if err = h.repo.CreateMeetingInvite(r.Context(), invite); err != nil {
			jsonError(w, "failed to create one or more invites", http.StatusInternalServerError)
			return
		}
		created = append(created, invite)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"count":   len(created),
		"invites": created,
	})
}

func (h *CollaborationHandler) ListMeetingInvites(w http.ResponseWriter, r *http.Request) {
	meetingID, err := uuid.Parse(chi.URLParam(r, "meetingId"))
	if err != nil {
		jsonError(w, "invalid meeting id", http.StatusBadRequest)
		return
	}

	invites, err := h.repo.ListMeetingInvites(r.Context(), meetingID)
	if err != nil {
		jsonError(w, "failed to fetch invites", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(invites)
}

func (h *CollaborationHandler) CreateTeam(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	var payload struct {
		Name        string  `json:"name"`
		Description *string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if payload.Name == "" {
		jsonError(w, "team name is required", http.StatusBadRequest)
		return
	}

	team := &domain.Team{
		Name:        payload.Name,
		Description: payload.Description,
		CreatedBy:   &userID,
	}
	if err := h.repo.CreateTeam(r.Context(), team); err != nil {
		jsonError(w, "failed to create team", http.StatusInternalServerError)
		return
	}

	_ = h.repo.AddTeamMember(r.Context(), &domain.TeamMember{
		TeamID: team.ID,
		UserID: userID,
		Role:   "owner",
	})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(team)
}

func (h *CollaborationHandler) ListTeams(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	teams, err := h.repo.ListTeamsByUser(r.Context(), userID)
	if err != nil {
		jsonError(w, "failed to list teams", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(teams)
}

func (h *CollaborationHandler) CreateChannel(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	teamID, err := uuid.Parse(chi.URLParam(r, "teamId"))
	if err != nil {
		jsonError(w, "invalid team id", http.StatusBadRequest)
		return
	}
	var payload struct {
		Name        string  `json:"name"`
		Description *string `json:"description"`
		IsPrivate   bool    `json:"is_private"`
	}
	if err = json.NewDecoder(r.Body).Decode(&payload); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if payload.Name == "" {
		jsonError(w, "channel name is required", http.StatusBadRequest)
		return
	}

	channel := &domain.TeamChannel{
		TeamID:      teamID,
		Name:        payload.Name,
		Description: payload.Description,
		IsPrivate:   payload.IsPrivate,
		CreatedBy:   &userID,
	}
	if err = h.repo.CreateChannel(r.Context(), channel); err != nil {
		jsonError(w, "failed to create channel", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(channel)
}

func (h *CollaborationHandler) ListChannels(w http.ResponseWriter, r *http.Request) {
	teamID, err := uuid.Parse(chi.URLParam(r, "teamId"))
	if err != nil {
		jsonError(w, "invalid team id", http.StatusBadRequest)
		return
	}
	channels, err := h.repo.ListChannelsByTeam(r.Context(), teamID)
	if err != nil {
		jsonError(w, "failed to list channels", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(channels)
}

func (h *CollaborationHandler) SendMessage(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	name, _ := r.Context().Value(middleware.UserNameKey).(string)
	email, _ := r.Context().Value(middleware.UserEmailKey).(string)

	teamID, err := uuid.Parse(chi.URLParam(r, "teamId"))
	if err != nil {
		jsonError(w, "invalid team id", http.StatusBadRequest)
		return
	}
	channelID, err := uuid.Parse(chi.URLParam(r, "channelId"))
	if err != nil {
		jsonError(w, "invalid channel id", http.StatusBadRequest)
		return
	}

	var payload struct {
		Body     string      `json:"body"`
		Metadata interface{} `json:"metadata"`
	}
	if err = json.NewDecoder(r.Body).Decode(&payload); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if payload.Body == "" {
		jsonError(w, "message body is required", http.StatusBadRequest)
		return
	}

	msg := &domain.ChatMessage{
		TeamID:      teamID,
		ChannelID:   channelID,
		SenderID:    &userID,
		SenderName:  &name,
		SenderEmail: &email,
		Body:        payload.Body,
		Metadata:    payload.Metadata,
	}
	if err = h.repo.CreateMessage(r.Context(), msg); err != nil {
		jsonError(w, "failed to send message", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(msg)
}

func (h *CollaborationHandler) ListMessages(w http.ResponseWriter, r *http.Request) {
	teamID, err := uuid.Parse(chi.URLParam(r, "teamId"))
	if err != nil {
		jsonError(w, "invalid team id", http.StatusBadRequest)
		return
	}
	channelID, err := uuid.Parse(chi.URLParam(r, "channelId"))
	if err != nil {
		jsonError(w, "invalid channel id", http.StatusBadRequest)
		return
	}

	messages, err := h.repo.ListMessages(r.Context(), teamID, channelID, 100)
	if err != nil {
		jsonError(w, "failed to list messages", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}
