package handlers

import (
	"fmt"
	"net/http"

	"github.com/nguyen/allycat/internal/places"
)

type PlacesHandler struct {
	api *places.PlacesApi
}

func NewPlacesHandler(placesApiKey string) (PlacesHandler, error) {
	api, err := places.NewPlacesApi(placesApiKey)

	if err != nil {
		return PlacesHandler{}, err
	}

	return PlacesHandler{
		api: api,
	}, nil
}

func (h PlacesHandler) HandleTextSearch(w http.ResponseWriter, r *http.Request) {
	res, err := h.api.TextSearch("malta boat club")

	if err != nil {
		w.Write([]byte(fmt.Sprintf("Error searching places: %v", err)))
	} else {
		w.Write(res)

	}
}
