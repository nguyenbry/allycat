package routes

import (
	"fmt"
	"log"
	"net/http"

	"errors"

	"github.com/go-chi/chi/v5"

	"github.com/alexedwards/argon2id"
	"github.com/nguyen/allycat/internal/http_server/handlers"
)

var ErrCompareFailed = errors.New("failed to compare password and hash")
var ErrHashFailed = errors.New("failed to hash password")
var ErrWeakPassword = errors.New("password is weak")

type password string

// creates a new password value object from a raw string
//
// returns ErrWeakPassword if the password is too weak
func newPassword(raw string) (password, error) {
	if len(raw) < 8 {
		return "", ErrWeakPassword
	}

	return password(raw), nil
}

func (p password) HashPassword() (string, error) {
	hash, err := argon2id.CreateHash(string(p), argon2id.DefaultParams)
	if err != nil {
		return "", fmt.Errorf("%w: %w", ErrHashFailed, err)
	}

	return hash, nil
}

func (p password) ComparePasswordAndHash(hash string) (bool, error) {
	match, err := argon2id.ComparePasswordAndHash(string(p), hash)
	if err != nil {
		return false, fmt.Errorf("%w: %w", ErrCompareFailed, err)
	}

	return match, nil
}

func InitializePlacesRoutes(r *chi.Mux, hs handlers.Handlers, pwHash string) {
	placesHandler := hs.Places

	placesRouter := chi.NewRouter()

	auth := func(next http.Handler) http.Handler {
		f := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

			tryPw := r.Header.Get("x-app-password")

			if tryPw == "" {
				log.Println("they tried it")
			} else {
				log.Printf("tried pw: %v\n", tryPw)
			}

			pw, err := newPassword(tryPw)

			if err != nil {
				log.Println("they tried it 2")
				log.Println(err.Error())
				handlers.WriteJSONResponse(w, handlers.NewResponse().WithMessage("Forbidden"), http.StatusForbidden)
				return
			}

			valid, err := pw.ComparePasswordAndHash(pwHash)

			if err != nil {
				log.Println("cmp failed")
				log.Println(err.Error())
				handlers.WriteJSONResponse(w, handlers.NewResponse().WithMessage("Forbidden"), http.StatusForbidden)
				return
			}

			if !valid {
				fmt.Println("verify failed")

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
