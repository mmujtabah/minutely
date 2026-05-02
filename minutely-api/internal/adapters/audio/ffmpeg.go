package audio

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"github.com/google/uuid"
)

// AudioExtractor defines an interface for processing audio from video/audio files
type AudioExtractor interface {
	// ExtractWav16kHz converts an input file path to a 16kHz mono WAV file path suitable for Whisper
	ExtractWav16kHz(ctx context.Context, inputFilePath string) (string, error)
	// Cleanup removes the temporary files
	Cleanup(filePaths ...string)
}

type ffmpegExtractor struct {
	tempDir string
}

func NewFFmpegExtractor(tempDir string) AudioExtractor {
	return &ffmpegExtractor{tempDir: tempDir}
}

func (e *ffmpegExtractor) ExtractWav16kHz(ctx context.Context, inputFilePath string) (string, error) {
	if e.tempDir != "" {
		if err := os.MkdirAll(e.tempDir, 0755); err != nil {
			return "", fmt.Errorf("failed to create temp dir: %w", err)
		}
	}

	outputFileName := fmt.Sprintf("%s.wav", uuid.New().String())
	outputFilePath := filepath.Join(e.tempDir, outputFileName)

	// Command: ffmpeg -i input.mp4 -ar 16000 -ac 1 -c:a pcm_s16le output.wav
	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-i", inputFilePath,
		"-ar", "16000",
		"-ac", "1",
		"-c:a", "pcm_s16le",
		"-y", // overwrite
		outputFilePath,
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("ffmpeg failed: %w, output: %s", err, string(output))
	}

	return outputFilePath, nil
}

func (e *ffmpegExtractor) Cleanup(filePaths ...string) {
	for _, p := range filePaths {
		if p != "" {
			_ = os.Remove(p)
		}
	}
}
