package workers

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/MinutelyAI/minutely-api/internal/core/domain"
)

// Pool is a fixed-size goroutine worker pool that polls for pending jobs
type Pool struct {
	concurrency   int
	jobRepo       domain.JobRepository
	processor     *FileProcessor
	pollInterval  time.Duration
	stopCh        chan struct{}
	wg            sync.WaitGroup
}

// NewPool creates a new worker pool
// concurrency = number of simultaneous jobs
// pollInterval = how often to check for new pending jobs
func NewPool(concurrency int, pollInterval time.Duration, jobRepo domain.JobRepository, processor *FileProcessor) *Pool {
	return &Pool{
		concurrency:  concurrency,
		jobRepo:      jobRepo,
		processor:    processor,
		pollInterval: pollInterval,
		stopCh:       make(chan struct{}),
	}
}

// Start launches the worker goroutines
func (p *Pool) Start(ctx context.Context) {
	log.Printf("[worker-pool] Starting %d workers (poll interval: %s)", p.concurrency, p.pollInterval)
	for i := 0; i < p.concurrency; i++ {
		p.wg.Add(1)
		go p.runWorker(ctx, i)
	}
}

// Stop gracefully shuts down the pool, waiting for in-flight jobs to finish
func (p *Pool) Stop() {
	log.Println("[worker-pool] Stopping workers...")
	close(p.stopCh)
	p.wg.Wait()
	log.Println("[worker-pool] All workers stopped.")
}

func (p *Pool) runWorker(ctx context.Context, id int) {
	defer p.wg.Done()
	ticker := time.NewTicker(p.pollInterval)
	defer ticker.Stop()

	log.Printf("[worker %d] Started", id)
	for {
		select {
		case <-p.stopCh:
			log.Printf("[worker %d] Shutting down", id)
			return
		case <-ctx.Done():
			log.Printf("[worker %d] Context cancelled", id)
			return
		case <-ticker.C:
			p.processOnePendingJob(ctx, id)
		}
	}
}

func (p *Pool) processOnePendingJob(ctx context.Context, workerID int) {
	// Priority: AI processing jobs first (unblock live meeting insights),
	// then file transcription jobs.
	jobTypes := []domain.JobType{
		domain.JobTypeAIProcessing,
		domain.JobTypeFileTranscription,
	}

	for _, jt := range jobTypes {
		jobs, err := p.jobRepo.ListPendingJobs(ctx, jt, 1)
		if err != nil {
			log.Printf("[worker %d] Error fetching %s jobs: %v", workerID, jt, err)
			continue
		}
		if len(jobs) == 0 {
			continue
		}

		job := jobs[0]

		// ── Optimistic Claim ────────────────────────────────────────────────
		// Transition the job from 'pending' → 'processing' before dispatching
		// it to the processor. Because the processor previously did this same
		// update at the top of Process(), moving it here means the job is
		// marked as taken before any other worker can see it as 'pending'.
		//
		// NOTE: For a fully atomic guarantee (zero double-processing risk),
		// add a Supabase RPC that runs:
		//   UPDATE processing_jobs SET status='processing', started_at=NOW(),
		//   attempt_count=attempt_count+1
		//   WHERE id=$1 AND status='pending' RETURNING *;
		// This can be added without changing the domain interface.
		now := time.Now()
		job.Status = domain.JobStatusProcessing
		job.StartedAt = &now
		job.AttemptCount++
		if claimErr := p.jobRepo.UpdateJob(ctx, job); claimErr != nil {
			log.Printf("[worker %d] Could not claim job %s: %v", workerID, job.ID, claimErr)
			return
		}

		log.Printf("[worker %d] Claimed job %s (type: %s, attempt: %d)", workerID, job.ID, job.JobType, job.AttemptCount)

		if err := p.processor.ProcessClaimed(ctx, job); err != nil {
			log.Printf("[worker %d] Job %s failed: %v", workerID, job.ID, err)
		}
		// Process one job per tick to keep workers evenly distributed
		return
	}
}
