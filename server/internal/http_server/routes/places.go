package routes

import (
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/nguyen/allycat/internal/http_server/handlers"
)

func InitializePlacesRoutes(r *chi.Mux, hs handlers.Handlers, pw string) {
	placesHandler := hs.Places

	placesRouter := chi.NewRouter()

	auth := func(next http.Handler) http.Handler {
		f := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

			if r.Header.Get("x-app-password") != pw {
				fmt.Println("no password")

				handlers.WriteJSONResponse(w, handlers.NewResponse().WithMessage("Forbidden"), http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
		return f
	}

	placesRouter.Use(auth)

	placesRouter.Post("/search", placesHandler.HandleTextSearch)
	placesRouter.Post("/optimize", placesHandler.HandleOptimizeRoute)

	// Mounting the new Sub Router on the main router
	r.Mount("/places", placesRouter)
}
