package http

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/MinutelyAI/minutely-api/internal/core/domain"
	"github.com/MinutelyAI/minutely-api/internal/transport/http/middleware"
)

type ActionItemHandler struct {
	repo domain.ActionItemRepository
}

func NewActionItemHandler(repo domain.ActionItemRepository) *ActionItemHandler {
	return &ActionItemHandler{repo: repo}
}

func (h *ActionItemHandler) ListOpenForUser(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.UserIDKey).(uuid.UUID)

	items, err := h.repo.ListOpenForUser(r.Context(), userID)
	if err != nil {
		jsonError(w, "failed to list action items", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

func (h *ActionItemHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		jsonError(w, "invalid action item id", http.StatusBadRequest)
		return
	}

	var payload struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	item, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		jsonError(w, "action item not found", http.StatusNotFound)
		return
	}

	item.Status = domain.ActionItemStatus(payload.Status)
	if err := h.repo.Update(r.Context(), item); err != nil {
		jsonError(w, "failed to update action item", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(item)
}
