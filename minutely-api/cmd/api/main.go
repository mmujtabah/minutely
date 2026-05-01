package main

import (
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/joho/godotenv"
	"github.com/supabase-community/supabase-go"

	"github.com/MinutelyAI/minutely-api/internal/adapters/postgres"
	"github.com/MinutelyAI/minutely-api/internal/core/services"
	apihttp "github.com/MinutelyAI/minutely-api/internal/transport/http"
	"github.com/MinutelyAI/minutely-api/internal/transport/http/middleware"
)

func main() {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: No .env file found or error loading it. Using environment variables.")
	}

	supabaseURL := os.Getenv("SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_KEY")

	if supabaseURL == "" || supabaseKey == "" {
		log.Fatal("SUPABASE_URL and SUPABASE_KEY must be set")
	}

	// Initialize Supabase Client
	client, err := supabase.NewClient(supabaseURL, supabaseKey, nil)
	if err != nil {
		log.Fatalf("Failed to initialize Supabase client: %v", err)
	}

	// Initialize Repositories (Using Supabase SDK instead of SQLC/pgx directly for now)
	profileRepo := postgres.NewSupabaseProfileRepo(client)
	meetingRepo := postgres.NewSupabaseMeetingRepo(client)

	// Initialize Services
	profileService := services.NewProfileService(profileRepo)
	meetingService := services.NewMeetingService(meetingRepo)

	// Initialize Handlers
	handler := apihttp.NewHandler(profileService, meetingService)

	// Set up Router
	r := chi.NewRouter()
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)

	// Register routes with the auth middleware configured with the Supabase client
	authMiddleware := middleware.NewSupabaseAuthMiddleware(client)
	
	r.Route("/api/v1", func(r chi.Router) {
		r.Use(authMiddleware.Handle)

		r.Route("/users", func(r chi.Router) {
			r.Get("/me", handler.GetProfile)
			r.Patch("/me", handler.UpdateProfile)
		})

		r.Route("/meetings", func(r chi.Router) {
			r.Post("/", handler.CreateMeeting)
			r.Get("/", handler.ListMeetings)
			r.Get("/{id}", handler.GetMeeting)
		})
	})

	// Start Server
	log.Println("Starting Minutely API on :8080")
	if err := http.ListenAndServe(":8080", r); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
