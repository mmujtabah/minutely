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
	// 1. Try to fetch an AI processing job first (higher priority for live meetings)
	jobs, err := p.jobRepo.ListPendingJobs(ctx, domain.JobTypeAIProcessing, 1)
	if err != nil {
		log.Printf("[worker %d] Error fetching AI jobs: %v", workerID, err)
	}

	// 2. If no AI jobs, try file transcription jobs
	if len(jobs) == 0 {
		jobs, err = p.jobRepo.ListPendingJobs(ctx, domain.JobTypeFileTranscription, 1)
		if err != nil {
			log.Printf("[worker %d] Error fetching file jobs: %v", workerID, err)
			return
		}
	}

	if len(jobs) == 0 {
		return // Nothing to do
	}

	job := jobs[0]
	log.Printf("[worker %d] Picked up job %s (type: %s)", workerID, job.ID, job.JobType)

	if err := p.processor.Process(ctx, job); err != nil {
		log.Printf("[worker %d] Job %s failed: %v", workerID, job.ID, err)
	}
}
