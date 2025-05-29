package routes

import (
	"github.com/go-chi/chi/v5"
	"github.com/nguyen/allycat/internal/http_server/handlers"
)

func InitializePlacesRoutes(r *chi.Mux, hs handlers.Handlers) {
	placesHandler := hs.Places

	placesRouter := chi.NewRouter()
	placesRouter.Get("/", placesHandler.HandleTextSearch)

	// Mounting the new Sub Router on the main router
	r.Mount("/places", placesRouter)
}
