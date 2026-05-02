package pythonai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/MinutelyAI/minutely-api/internal/core/domain"
)

type pythonAIProcessor struct {
	endpointUrl    string
	aiOutputRepo   domain.AIOutputRepository
	actionItemRepo domain.ActionItemRepository
}

func NewPythonAIProcessor(endpointUrl string, aiOutputRepo domain.AIOutputRepository, actionItemRepo domain.ActionItemRepository) domain.AIProcessor {
	return &pythonAIProcessor{
		endpointUrl:    endpointUrl,
		aiOutputRepo:   aiOutputRepo,
		actionItemRepo: actionItemRepo,
	}
}

func (p *pythonAIProcessor) ProcessTranscript(ctx context.Context, event domain.AIEvent) error {
	payloadBytes, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal AI event: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", p.endpointUrl+"/process", bytes.NewBuffer(payloadBytes))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to call python AI service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("python AI service returned status: %d", resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("failed to decode python AI service response: %w", err)
	}

	// Create a single comprehensive AIOutput record containing the full JSON payload
	modelUsed := "bart-large-cnn/kmeans"
	output := &domain.AIOutput{
		MeetingID:    event.MeetingID,
		TranscriptID: &event.TranscriptID,
		OutputType:   domain.AIOutputTypeSummary,
		Status:       domain.AIOutputStatusCompleted,
		ModelUsed:    &modelUsed,
		Result:       result,
	}

	if err := p.aiOutputRepo.Create(ctx, output); err != nil {
		return fmt.Errorf("failed to save AI output to db: %w", err)
	}

	// Also extract and persist action items
	if actionItemsInterface, ok := result["action_items"]; ok {
		if actionItemsList, ok := actionItemsInterface.([]interface{}); ok {
			for _, itemInterface := range actionItemsList {
				if itemMap, ok := itemInterface.(map[string]interface{}); ok {
					task, _ := itemMap["task"].(string)
					assignee, _ := itemMap["assignee"].(string)
					// deadline, _ := itemMap["deadline"].(string)
					
					if task != "" {
						actionItem := &domain.ActionItem{
							MeetingID:    event.MeetingID,
							TranscriptID: &event.TranscriptID,
							Task:         task,
							Status:       domain.ActionItemStatusOpen,
						}
						
						if assignee != "" {
							actionItem.AssigneeName = &assignee
						}
						
						if err := p.actionItemRepo.Create(ctx, actionItem); err != nil {
							log.Printf("[AIProcessor] Warning: failed to save action item '%s': %v", task, err)
						}
					}
				}
			}
		}
	}

	return nil
}
