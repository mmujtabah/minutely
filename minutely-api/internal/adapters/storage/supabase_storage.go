package storage

import (
	"context"
	"io"
	"bytes"

	storage_go "github.com/supabase-community/storage-go"
	"github.com/MinutelyAI/minutely-api/internal/core/domain"
)

type supabaseStorage struct {
	client *storage_go.Client
}

func NewSupabaseStorage(url, key string) domain.StorageService {
	client := storage_go.NewClient(url, key, nil)
	return &supabaseStorage{client: client}
}

func (s *supabaseStorage) UploadFile(ctx context.Context, bucket string, path string, body io.Reader, contentType string) (string, error) {
	// The storage-go client Upload method expects an io.Reader and returns the file path on success
	// We might need to read it entirely if we don't know the size, or if the client requires it.
	// We'll pass the body directly for stream-like upload if supported.
	res, err := s.client.UploadFile(bucket, path, body)
	if err != nil {
		return "", err
	}
	// res.Key contains the uploaded path
	return res.Key, nil
}

func (s *supabaseStorage) DownloadFile(ctx context.Context, bucket string, path string) (io.ReadCloser, error) {
	data, err := s.client.DownloadFile(bucket, path)
	if err != nil {
		return nil, err
	}
	return io.NopCloser(bytes.NewReader(data)), nil
}

func (s *supabaseStorage) GetSignedURL(ctx context.Context, bucket string, path string, expiresIn int) (string, error) {
	res, err := s.client.CreateSignedUrl(bucket, path, expiresIn)
	if err != nil {
		return "", err
	}
	return res.SignedURL, nil
}

func (s *supabaseStorage) DeleteFile(ctx context.Context, bucket string, path string) error {
	_, err := s.client.RemoveFile(bucket, []string{path})
	return err
}
