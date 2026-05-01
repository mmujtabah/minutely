package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/supabase-community/supabase-go"
)

type contextKey string
const UserIDKey contextKey = "user_id"

type SupabaseAuth struct {
	client *supabase.Client
}

func NewSupabaseAuthMiddleware(client *supabase.Client) *SupabaseAuth {
	return &SupabaseAuth{client: client}
}

func (m *SupabaseAuth) Handle(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Unauthorized: missing authorization header", http.StatusUnauthorized)
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, "Unauthorized: invalid authorization header format", http.StatusUnauthorized)
			return
		}

		token := parts[1]

		// Use Supabase to fetch the user associated with this JWT
		user, err := m.client.Auth.WithToken(token).GetUser()
		if err != nil || user == nil {
			http.Error(w, "Unauthorized: invalid or expired token", http.StatusUnauthorized)
			return
		}

		userID, err := uuid.Parse(user.ID.String())
		if err != nil {
			http.Error(w, "Unauthorized: invalid user ID format", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), UserIDKey, userID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
