package http

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/MinutelyAI/minutely-api/internal/core/domain"
	"github.com/MinutelyAI/minutely-api/internal/transport/http/middleware"
	"github.com/MinutelyAI/minutely-api/internal/transport/ws"
)

type LiveTranscriptionHandler struct {
	transcriptionService domain.TranscriptionService
	meetingService       domain.MeetingService
	wsHub                *ws.Hub
}

func NewLiveTranscriptionHandler(ts domain.TranscriptionService, ms domain.MeetingService, hub *ws.Hub) *LiveTranscriptionHandler {
	return &LiveTranscriptionHandler{
		transcriptionService: ts,
		meetingService:       ms,
		wsHub:                hub,
	}
}

func (h *LiveTranscriptionHandler) parseOrGenerateMeetingID(r *http.Request) uuid.UUID {
	meetingIDStr := chi.URLParam(r, "meetingId")
	meetingID, err := uuid.Parse(meetingIDStr)
	if err != nil {
		// It's a Jitsi string name, generate a deterministic UUID
		meetingID = uuid.NewMD5(uuid.NameSpaceURL, []byte(meetingIDStr))

		// Try to extract userID from context (if route is authenticated)
		var userIDPtr *uuid.UUID
		if val := r.Context().Value(middleware.UserIDKey); val != nil {
			if uid, ok := val.(uuid.UUID); ok {
				userIDPtr = &uid
			}
		}

		// Lazily create a dummy meeting if it doesn't exist so foreign keys don't fail
		_, _ = h.meetingService.GetMeeting(r.Context(), meetingID)
		err = h.meetingService.CreateMeeting(r.Context(), &domain.Meeting{
			ID:        meetingID,
			UserID:    userIDPtr,
			Title:     meetingIDStr,
			Status:    domain.MeetingStatusInProgress,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		})
		if err != nil {
			fmt.Printf("Warning: failed to create dummy meeting: %v\n", err)
		}
	}
	return meetingID
}

// StartSession initiates a live transcription session and returns a Deepgram key
// POST /api/v1/meetings/{meetingId}/transcription/start
func (h *LiveTranscriptionHandler) StartSession(w http.ResponseWriter, r *http.Request) {
	meetingID := h.parseOrGenerateMeetingID(r)

	session, token, err := h.transcriptionService.StartLiveSession(r.Context(), meetingID)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"session_id":             session.ID,
		"deepgram_token":         token,
		"deepgram_token_expires": session.DeepgramTokenExpires,
	})
}

// EndSession marks a live transcription session as ended
// POST /api/v1/meetings/{meetingId}/transcription/end
func (h *LiveTranscriptionHandler) EndSession(w http.ResponseWriter, r *http.Request) {
	meetingID := h.parseOrGenerateMeetingID(r)

	if err := h.transcriptionService.EndLiveSession(r.Context(), meetingID); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ended"})
}

// HandleWebSocket upgrades the HTTP request to a WebSocket connection for the meeting
// GET /api/v1/meetings/{meetingId}/transcription/ws
func (h *LiveTranscriptionHandler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	meetingID := h.parseOrGenerateMeetingID(r)

	// Upgrade the connection and register client with the hub
	ws.ServeWs(h.wsHub, meetingID, w, r)
}
