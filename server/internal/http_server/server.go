package server

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/nguyen/allycat/internal/http_server/handlers"
	"github.com/nguyen/allycat/internal/http_server/routes"
)

type Server struct {
	initialized bool
	mux         *chi.Mux
}

func NewServer() *Server {
	mux := chi.NewRouter()

	return &Server{
		mux: mux,
	}
}

func (s *Server) RegisterRoutes(hs handlers.Handlers, pw string) {
	routes.InitializePlacesRoutes(s.mux, hs, pw)

	s.initialized = true
}

func (s *Server) Start(addr string, allowedOrigin string) error {
	if !s.initialized {
		return errors.New("server routes not initialized, call RegisterRoutes first")
	}

	r := chi.NewRouter()

	// Basic CORS
	// for more ideas, see: https://developer.github.com/v3/#cross-origin-resource-sharing
	r.Use(cors.Handler(cors.Options{
		// AllowedOrigins:   []string{"https://foo.com"}, // Use this to allow specific origin hosts
		AllowedOrigins: []string{allowedOrigin},
		// AllowOriginFunc:  func(r *http.Request, origin string) bool { return true },
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-App-Password"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300, // Maximum value not ignored by any of major browsers
	}))

	r.Use(middleware.Logger)

	// healthcheck
	r.Get("/status", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})

	r.Mount("/api", s.mux)

	server := &http.Server{Addr: addr, Handler: r}
	return server.ListenAndServe()
}
