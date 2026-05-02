package postgres

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	postgrest "github.com/supabase-community/postgrest-go"
	"github.com/supabase-community/supabase-go"

	"github.com/MinutelyAI/minutely-api/internal/core/domain"
)

type supabaseJobRepo struct {
	client *supabase.Client
}

func NewSupabaseJobRepo(client *supabase.Client) domain.JobRepository {
	return &supabaseJobRepo{client: client}
}

func (r *supabaseJobRepo) CreateJob(ctx context.Context, job *domain.ProcessingJob) error {
	if job.ID == uuid.Nil {
		job.ID = uuid.New()
	}

	data, _, err := r.client.From("processing_jobs").Insert(job, false, "exact", "representation", "id").Execute()
	if err != nil {
		return err
	}

	if len(data) > 0 {
		var created []domain.ProcessingJob
		if err := json.Unmarshal(data, &created); err == nil && len(created) > 0 {
			*job = created[0]
		}
	}

	return nil
}

func (r *supabaseJobRepo) GetJobByID(ctx context.Context, id uuid.UUID) (*domain.ProcessingJob, error) {
	data, _, err := r.client.From("processing_jobs").Select("*", "exact", false).Eq("id", id.String()).Single().Execute()
	if err != nil {
		return nil, err
	}

	if len(data) == 0 {
		return nil, errors.New("job not found")
	}

	var job domain.ProcessingJob
	if err := json.Unmarshal(data, &job); err != nil {
		return nil, err
	}

	return &job, nil
}

func (r *supabaseJobRepo) UpdateJob(ctx context.Context, job *domain.ProcessingJob) error {
	_, _, err := r.client.From("processing_jobs").Update(job, "exact", "id").Eq("id", job.ID.String()).Execute()
	return err
}

func (r *supabaseJobRepo) ListPendingJobs(ctx context.Context, jobType domain.JobType, limit int) ([]*domain.ProcessingJob, error) {
	query := r.client.From("processing_jobs").Select("*", "exact", false).Eq("status", string(domain.JobStatusPending))
	if jobType != "" {
		query = query.Eq("job_type", string(jobType))
	}
	
	// Limit is not directly supported as an integer argument in some versions of the wrapper
	// We'll use order to get oldest first.
	// Since the postgrest-go client can be tricky, we'll try basic query.
	data, _, err := query.Order("created_at", &postgrest.OrderOpts{Ascending: true}).Execute()
	if err != nil {
		return nil, err
	}

	var jobs []*domain.ProcessingJob
	if err := json.Unmarshal(data, &jobs); err != nil {
		return nil, err
	}

	// Manual limit if the query doesn't restrict it properly via the wrapper
	if limit > 0 && len(jobs) > limit {
		jobs = jobs[:limit]
	}

	return jobs, nil
}

func (r *supabaseJobRepo) CreateMediaFile(ctx context.Context, media *domain.MediaFile) error {
	if media.ID == uuid.Nil {
		media.ID = uuid.New()
	}

	data, _, err := r.client.From("media_files").Insert(media, false, "exact", "representation", "id").Execute()
	if err != nil {
		return err
	}

	if len(data) > 0 {
		var created []domain.MediaFile
		if err := json.Unmarshal(data, &created); err == nil && len(created) > 0 {
			*media = created[0]
		}
	}

	return nil
}

func (r *supabaseJobRepo) GetMediaFileByID(ctx context.Context, id uuid.UUID) (*domain.MediaFile, error) {
	data, _, err := r.client.From("media_files").Select("*", "exact", false).Eq("id", id.String()).Single().Execute()
	if err != nil {
		return nil, err
	}

	if len(data) == 0 {
		return nil, errors.New("media file not found")
	}

	var media domain.MediaFile
	if err := json.Unmarshal(data, &media); err != nil {
		return nil, err
	}

	return &media, nil
}

func (r *supabaseJobRepo) UpdateMediaFile(ctx context.Context, media *domain.MediaFile) error {
	_, _, err := r.client.From("media_files").Update(media, "exact", "id").Eq("id", media.ID.String()).Execute()
	return err
}
