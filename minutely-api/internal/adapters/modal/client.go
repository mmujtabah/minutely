package modal

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"time"
)

// TranscriptionResult matches the output expected from the Modal python endpoint
type TranscriptionResult struct {
	Text     string             `json:"text"`
	Language string             `json:"language"`
	Segments []DiarizedSegment  `json:"segments"`
	Info     TranscriptionInfo  `json:"info"`
}

type DiarizedSegment struct {
	Speaker string  `json:"speaker"`
	Text    string  `json:"text"`
	Start   float64 `json:"start"`
	End     float64 `json:"end"`
}

type TranscriptionInfo struct {
	DurationSecs float64 `json:"duration_secs"`
	SpeakerCount int     `json:"speaker_count"`
}

type Client interface {
	TranscribeAudio(ctx context.Context, audioFilePath string, language string) (*TranscriptionResult, error)
}

type modalClient struct {
	endpoint string
	token    string
	client   *http.Client
}

func NewModalClient(endpoint string, token string) Client {
	return &modalClient{
		endpoint: endpoint,
		token:    token,
		client: &http.Client{
			Timeout: 10 * time.Minute, // Transcription can take several minutes
		},
	}
}

func (c *modalClient) TranscribeAudio(ctx context.Context, audioFilePath string, language string) (*TranscriptionResult, error) {
	file, err := os.Open(audioFilePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open audio file: %w", err)
	}
	defer file.Close()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	
	// Add the file part
	part, err := writer.CreateFormFile("file", "audio.wav")
	if err != nil {
		return nil, fmt.Errorf("failed to create form file: %w", err)
	}
	if _, err := io.Copy(part, file); err != nil {
		return nil, fmt.Errorf("failed to copy file contents: %w", err)
	}

	// Add language if specified
	if language != "" {
		if err := writer.WriteField("language", language); err != nil {
			return nil, fmt.Errorf("failed to write language field: %w", err)
		}
	}

	err = writer.Close()
	if err != nil {
		return nil, fmt.Errorf("failed to close multipart writer: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.endpoint, body)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("modal API returned status %d: %s", resp.StatusCode, string(respBody))
	}

	var result TranscriptionResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}
