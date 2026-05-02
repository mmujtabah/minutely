package ws

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/MinutelyAI/minutely-api/internal/core/domain"
)

// SegmentMessage represents a partial or final transcript segment
// received from a client during a live meeting.
type SegmentMessage struct {
	MeetingID    uuid.UUID `json:"-"`
	MeetingName  string    `json:"meeting_id"`
	SpeakerName  string    `json:"speaker_name"`
	SpeakerEmail string    `json:"speaker_email"`
	Text         string    `json:"text"`
	StartSecs    float64   `json:"start_secs"`
	EndSecs      float64   `json:"end_secs"`
	IsPartial    bool      `json:"is_partial"`
}

// Hub maintains the set of active clients and broadcasts messages to the clients.
type Hub struct {
	// Registered clients mapped by meeting ID
	clients map[uuid.UUID]map[*Client]bool

	// Inbound messages from the clients.
	broadcast chan *SegmentMessage

	// Register requests from the clients.
	register chan *Client

	// Unregister requests from clients.
	unregister chan *Client

	mu sync.RWMutex

	transcriptRepo domain.TranscriptRepository
}

func NewHub(transcriptRepo domain.TranscriptRepository) *Hub {
	return &Hub{
		broadcast:      make(chan *SegmentMessage),
		register:       make(chan *Client),
		unregister:     make(chan *Client),
		clients:        make(map[uuid.UUID]map[*Client]bool),
		transcriptRepo: transcriptRepo,
	}
}

func (h *Hub) Run(ctx context.Context) {
	log.Println("WebSocket Hub started")
	for {
		select {
		case <-ctx.Done():
			log.Println("WebSocket Hub shutting down")
			return
		case client := <-h.register:
			h.mu.Lock()
			if _, ok := h.clients[client.MeetingID]; !ok {
				h.clients[client.MeetingID] = make(map[*Client]bool)
			}
			h.clients[client.MeetingID][client] = true
			h.mu.Unlock()
			log.Printf("Client registered to meeting %s. Total clients in meeting: %d", client.MeetingID, len(h.clients[client.MeetingID]))

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.MeetingID]; ok {
				if _, ok := h.clients[client.MeetingID][client]; ok {
					delete(h.clients[client.MeetingID], client)
					close(client.send)
					if len(h.clients[client.MeetingID]) == 0 {
						delete(h.clients, client.MeetingID)
					}
				}
			}
			h.mu.Unlock()
			log.Printf("Client unregistered from meeting %s", client.MeetingID)

		case message := <-h.broadcast:
			// 1. Broadcast to all other clients in the same meeting
			h.mu.RLock()
			for client := range h.clients[message.MeetingID] {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients[message.MeetingID], client)
				}
			}
			h.mu.RUnlock()

			// 2. Persist to DB if it's a final segment
			if !message.IsPartial {
				h.persistSegment(message)
			}
		}
	}
}

func (h *Hub) persistSegment(msg *SegmentMessage) {
	// First, we need to find the active TranscriptID for this meeting
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	session, err := h.transcriptRepo.GetLiveSessionByMeetingID(ctx, msg.MeetingID)
	if err != nil || session.TranscriptID == nil {
		log.Printf("Failed to find active live session for meeting %s: %v", msg.MeetingID, err)
		return
	}

	segment := &domain.TranscriptSegment{
		TranscriptID: *session.TranscriptID,
		SpeakerName:  msg.SpeakerName,
		SpeakerEmail: msg.SpeakerEmail,
		Text:         msg.Text,
		StartSecs:    msg.StartSecs,
		EndSecs:      msg.EndSecs,
		IsPartial:    false,
	}

	if err := h.transcriptRepo.CreateSegment(ctx, segment); err != nil {
		log.Printf("Failed to persist segment for meeting %s: %v", msg.MeetingID, err)
	}
}
