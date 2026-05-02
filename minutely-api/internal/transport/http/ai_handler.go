package http

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/MinutelyAI/minutely-api/internal/core/domain"
)

type AIHandler struct {
	aiOutputRepo domain.AIOutputRepository
}

func NewAIHandler(aiOutputRepo domain.AIOutputRepository) *AIHandler {
	return &AIHandler{aiOutputRepo: aiOutputRepo}
}

// GetMeetingInsights returns the AI insights for a given meeting
// GET /api/v1/meetings/{meetingId}/ai-insights
func (h *AIHandler) GetMeetingInsights(w http.ResponseWriter, r *http.Request) {
	meetingIDStr := chi.URLParam(r, "meetingId")
	meetingID, err := uuid.Parse(meetingIDStr)
	if err != nil {
		// Bypassing strict UUID check for Jitsi dev prototype (just like we did for transcription)
		meetingID = uuid.NewMD5(uuid.NameSpaceURL, []byte(meetingIDStr))
	}

	outputs, err := h.aiOutputRepo.ListByMeetingID(r.Context(), meetingID)
	if err != nil {
		jsonError(w, "failed to fetch ai insights", http.StatusInternalServerError)
		return
	}

	// We'll return the most recent output of each type, or just the list
	// Currently the UI will likely look for the first one, but let's return the full list.
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(outputs)
}
