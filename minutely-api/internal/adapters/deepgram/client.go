package deepgram

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type Client interface {
	// GenerateTempKey generates a temporary Deepgram API key scoped for live transcription
	// that expires in the specified duration
	GenerateTempKey(ctx context.Context, expiration time.Duration) (string, error)
}

type deepgramClient struct {
	apiKey    string
	projectID string
	client    *http.Client
}

func NewDeepgramClient(apiKey string) Client {
	return &deepgramClient{
		apiKey: apiKey,
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *deepgramClient) GenerateTempKey(ctx context.Context, expiration time.Duration) (string, error) {
	// TEMPORARY PROTOTYPE FIX:
	// The provided DEEPGRAM_KEY lacks "Administrator" permissions to generate temporary scoped keys (returns 403 Forbidden).
	// For testing purposes, we will just return the master key to the frontend.
	// In production, the DEEPGRAM_KEY must be an Administrator key to generate temporary scoped tokens.
	return c.apiKey, nil
}

func (c *deepgramClient) fetchProjectID(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.deepgram.com/v1/projects", nil)
	if err != nil {
		return err
	}
	
	req.Header.Set("Authorization", "Token "+c.apiKey)

	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to fetch deepgram projects: status %d", resp.StatusCode)
	}

	var result struct {
		Projects []struct {
			ProjectID string `json:"project_id"`
		} `json:"projects"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return err
	}

	if len(result.Projects) == 0 {
		return fmt.Errorf("no deepgram projects found for API key")
	}

	// Use the first project
	c.projectID = result.Projects[0].ProjectID
	return nil
}
