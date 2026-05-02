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
	// ExtractWav16kHz converts any input file to a preprocessed 16kHz mono WAV
	// suitable for Whisper. Applies audio preprocessing for better transcription accuracy.
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

// ExtractWav16kHz converts an input media file (audio or video) to a clean
// 16kHz mono WAV with the following preprocessing chain:
//
//  1. highpass=f=80       — removes low-frequency rumble below 80Hz (desk vibrations, mic handling)
//  2. loudnorm            — EBU R128 loudness normalization (consistent volume for Whisper)
//                           I=-16:LRA=11:TP=-1.5 targets broadcast standard loudness
//  3. silenceremove       — strips leading/trailing silence longer than 1s at -50dBFS
//                           reduces unnecessary audio sent to Whisper, lowering cost + latency
func (e *ffmpegExtractor) ExtractWav16kHz(ctx context.Context, inputFilePath string) (string, error) {
	if e.tempDir != "" {
		if err := os.MkdirAll(e.tempDir, 0755); err != nil {
			return "", fmt.Errorf("failed to create temp dir: %w", err)
		}
	}

	outputFileName := fmt.Sprintf("%s.wav", uuid.New().String())
	outputFilePath := filepath.Join(e.tempDir, outputFileName)

	// Audio filter chain for improved transcription accuracy:
	//   highpass → loudnorm → silenceremove
	audioFilter := "highpass=f=80," +
		"loudnorm=I=-16:LRA=11:TP=-1.5," +
		"silenceremove=start_periods=1:start_silence=1:start_threshold=-50dB" +
		":stop_periods=-1:stop_silence=1:stop_threshold=-50dB"

	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-i", inputFilePath,
		"-af", audioFilter,
		"-ar", "16000",
		"-ac", "1",
		"-c:a", "pcm_s16le",
		"-y", // overwrite if exists
		outputFilePath,
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("ffmpeg preprocessing failed: %w\nffmpeg output: %s", err, string(output))
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
