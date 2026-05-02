package domain

import (
	"context"
	"io"
)

// StorageService defines operations for cloud file storage
type StorageService interface {
	// UploadFile uploads an io.Reader to the storage bucket and returns the generated path
	UploadFile(ctx context.Context, bucket string, path string, body io.Reader, contentType string) (string, error)
	
	// DownloadFile downloads a file from the storage bucket
	DownloadFile(ctx context.Context, bucket string, path string) (io.ReadCloser, error)
	
	// GetSignedURL generates a temporary signed URL for a file
	GetSignedURL(ctx context.Context, bucket string, path string, expiresIn int) (string, error)
	
	// DeleteFile removes a file from the storage bucket
	DeleteFile(ctx context.Context, bucket string, path string) error
}
