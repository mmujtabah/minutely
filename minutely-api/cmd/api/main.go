package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/joho/godotenv"
	"github.com/supabase-community/supabase-go"

	"github.com/MinutelyAI/minutely-api/internal/adapters/audio"
	"github.com/MinutelyAI/minutely-api/internal/adapters/deepgram"
	"github.com/MinutelyAI/minutely-api/internal/adapters/modal"
	"github.com/MinutelyAI/minutely-api/internal/adapters/postgres"
	"github.com/MinutelyAI/minutely-api/internal/adapters/pythonai"
	adapterStorage "github.com/MinutelyAI/minutely-api/internal/adapters/storage"
	"github.com/MinutelyAI/minutely-api/internal/core/services"
	apihttp "github.com/MinutelyAI/minutely-api/internal/transport/http"
	"github.com/MinutelyAI/minutely-api/internal/transport/http/middleware"
	"github.com/MinutelyAI/minutely-api/internal/transport/ws"
	"github.com/MinutelyAI/minutely-api/internal/workers"
)

func main() {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: No .env file found or error loading it. Using environment variables.")
	}

	supabaseURL := os.Getenv("SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_KEY")
	modalEndpoint := os.Getenv("MODAL_ENDPOINT")
	modalToken := os.Getenv("MODAL_TOKEN")
	storageBucket := os.Getenv("STORAGE_BUCKET")
	if storageBucket == "" {
		storageBucket = "recordings"
	}

	if supabaseURL == "" || supabaseKey == "" {
		log.Fatal("SUPABASE_URL and SUPABASE_KEY must be set")
	}
	if modalEndpoint == "" {
		log.Fatal("MODAL_ENDPOINT must be set")
	}

	// Initialize Supabase Client
	client, err := supabase.NewClient(supabaseURL, supabaseKey, nil)
	if err != nil {
		log.Fatalf("Failed to initialize Supabase client: %v", err)
	}

	// --- Repositories ---
	profileRepo := postgres.NewSupabaseProfileRepo(client)
	meetingRepo := postgres.NewSupabaseMeetingRepo(client)
	transcriptRepo := postgres.NewSupabaseTranscriptRepo(client)
	jobRepo := postgres.NewSupabaseJobRepo(client)
	aiOutputRepo := postgres.NewSupabaseAIOutputRepo(client)



	// --- Adapters ---
	storageURL := supabaseURL + "/storage/v1"
	storageService := adapterStorage.NewSupabaseStorage(storageURL, supabaseKey)
	audioExtractor := audio.NewFFmpegExtractor(os.TempDir())
	modalClient := modal.NewModalClient(modalEndpoint, modalToken)
	
	deepgramKey := os.Getenv("DEEPGRAM_KEY")
	if deepgramKey == "" {
		log.Println("Warning: DEEPGRAM_KEY not set. Live transcription will not work.")
	}
	dgClient := deepgram.NewDeepgramClient(deepgramKey)

	// --- Action Item Repo ---
	actionItemRepo := postgres.NewSupabaseActionItemRepo(client)

	// --- AI Processor (Hits Modal serverless endpoint) ---
	aiEndpoint := os.Getenv("MODAL_AI_ENDPOINT")
	if aiEndpoint == "" {
		aiEndpoint = "http://127.0.0.1:8000"
	}
	aiProcessor := pythonai.NewPythonAIProcessor(aiEndpoint, aiOutputRepo, actionItemRepo)

	// --- Services ---
	profileService := services.NewProfileService(profileRepo)
	meetingService := services.NewMeetingService(meetingRepo)
	transcriptionService := services.NewTranscriptionService(transcriptRepo, jobRepo, dgClient)

	// --- File Processor & Worker Pool ---
	fileProcessor := workers.NewFileProcessor(
		transcriptRepo,
		jobRepo,
		storageService,
		audioExtractor,
		modalClient,
		aiProcessor,
		storageBucket,
		os.TempDir(),
	)
	workerPool := workers.NewPool(3, 5*time.Second, jobRepo, fileProcessor)
	workerPool.Start(context.Background())
	defer workerPool.Stop()

	// --- WebSocket Hub ---
	wsHub := ws.NewHub(transcriptRepo)
	go wsHub.Run(context.Background())

	// --- HTTP Handlers ---
	handler := apihttp.NewHandler(profileService, meetingService)
	transcriptionHandler := apihttp.NewTranscriptionHandler(
		transcriptRepo,
		jobRepo,
		storageService,
		meetingService,
		storageBucket,
	)
	liveHandler := apihttp.NewLiveTranscriptionHandler(transcriptionService, meetingService, wsHub)
	aiHandler := apihttp.NewAIHandler(aiOutputRepo)

	actionItemHandler := apihttp.NewActionItemHandler(actionItemRepo)

	// --- Router ---
	r := chi.NewRouter()
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)

	authMiddleware := middleware.NewSupabaseAuthMiddleware(client)

	r.Route("/api/v1", func(r chi.Router) {
		r.Route("/users", func(r chi.Router) {
			r.Use(authMiddleware.Handle)
			r.Get("/me", handler.GetProfile)
			r.Patch("/me", handler.UpdateProfile)
		})

		r.Route("/meetings", func(r chi.Router) {
			// Public routes
			r.Get("/{meetingId}/transcript", transcriptionHandler.GetMeetingTranscript)
			r.Get("/{meetingId}/ai-insights", aiHandler.GetMeetingInsights)
			r.Post("/{meetingId}/recordings/upload", transcriptionHandler.UploadRecording)
			r.Post("/{meetingId}/transcription/start", liveHandler.StartSession)
			r.Post("/{meetingId}/transcription/end", liveHandler.EndSession)

			// Authenticated routes
			r.Group(func(r chi.Router) {
				r.Use(authMiddleware.Handle)
				r.Post("/", handler.CreateMeeting)
				r.Get("/", handler.ListMeetings)
				r.Get("/summaries", handler.ListMeetingSummaries)
				r.Get("/{id}", handler.GetMeeting)
			})
		})

		r.Route("/stats", func(r chi.Router) {
			r.Use(authMiddleware.Handle)
			r.Get("/", handler.GetDashboardStats)
		})

		r.Route("/action-items", func(r chi.Router) {
			r.Use(authMiddleware.Handle)
			r.Get("/", actionItemHandler.ListOpenForUser)
			r.Patch("/{id}/status", actionItemHandler.UpdateStatus)
		})

		r.Route("/jobs", func(r chi.Router) {
			r.Get("/{jobId}", transcriptionHandler.GetJobStatus)
			r.Get("/{jobId}/progress", transcriptionHandler.GetJobProgress)
		})
	})


	// Public WebSocket endpoint (no auth middleware for now, or you can add ticket-based auth later)
	r.Get("/api/v1/meetings/{meetingId}/transcription/ws", liveHandler.HandleWebSocket)

	// --- Start Server ---
	log.Println("Starting Minutely API on :8081")
	if err := http.ListenAndServe(":8081", r); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
