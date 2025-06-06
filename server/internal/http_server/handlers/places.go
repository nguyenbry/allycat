package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/nguyen/allycat/internal/places"
)

var testStr string = `{"start":"ChIJMyz2gkXGxokRcCqrYbUuia4","stops":["ChIJ76GvGOvGxokR_qrOIBats84","Ei80MDAwIEJhbHRpbW9yZSBBdmUsIFBoaWxhZGVscGhpYSwgUEEgMTkxMDQsIFVTQSIxEi8KFAoSCSEZCX32xsaJEUD0EsV6XxKxEKAfKhQKEglDzC0av8bGiRH86g2jblqjdA","ChIJXSJY2vfGxokRSeHsSBbDiGI","ChIJpZVajITHxokRZT6VDp4tvtk","Ei8yNjAwIFcgRmxldGNoZXIgU3QsIFBoaWxhZGVscGhpYSwgUEEgMTkxMzIsIFVTQSIxEi8KFAoSCQkYPhPtx8aJEbzdT0DCUQ4UEKgUKhQKEgld1z_HksfGiREWTRpp3WzGpw","ChIJ5TjjILHHxokRsUNYkTmxXGg","ChIJZxBULUDGxokRj3Dr_aK3YuQ","ChIJ9Sdt-zHGxokRad5acsk-ifo"],"end":"ChIJuTEqMEnGxokRbpR8XPtsVQs"}`

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
	var reqBody places.TextSearchOptions

	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		writeJSONResponse(w, newResponse().message(fmt.Sprintf("Error decoding request body: %v", err)), http.StatusBadRequest)
	}

	if len(reqBody.Query) < 4 {
		writeJSONResponse(w, newResponse().message("Query must be at least 4 characters long"), http.StatusBadRequest)
		return
	}

	fmt.Println("Received text search query:", reqBody.Query)

	res, err := h.api.TextSearch(reqBody)

	if err != nil {
		writeJSONResponse(w, newResponse().message(fmt.Sprintf("Error searching places: %v", err)), http.StatusInternalServerError)
	} else {
		writeJSONResponse(w, newResponse().data(res), http.StatusOK)
	}
}

func (h PlacesHandler) HandleOptimizeRoute(w http.ResponseWriter, r *http.Request) {
	var reqBody struct {
		Start string   `json:"origin"`
		Stops []string `json:"stops"`
		End   *string  `json:"destination"`
	}

	// if err := json.Unmarshal([]byte(testStr), &reqBody); err != nil {
	// 	writeJSONResponse(w, newResponse().message("Invalid payload"), http.StatusBadRequest)
	// 	return
	// }
	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		writeJSONResponse(w, newResponse().message("Invalid payload"), http.StatusBadRequest)
		return
	} else if reqBody.Start == "" {
		writeJSONResponse(w, newResponse().message("Start location is required"), http.StatusBadRequest)
		return
	} else if len(reqBody.Stops) < 2 {
		writeJSONResponse(w, newResponse().message("At least two stops are required"), http.StatusBadRequest)
		return
	} else if reqBody.End != nil && *reqBody.End == "" {
		writeJSONResponse(w, newResponse().message("Destination is empty"), http.StatusBadRequest)
		return
	}

	payload := places.
		NewOptimizeRoutePayloadBuilder().
		WithStart(reqBody.Start).
		WithStops(reqBody.Stops).WithEnd(reqBody.End)

	err := h.api.OptimizeRoute(payload)

	if err != nil {
		w.Write([]byte(err.Error()))
	} else {
		w.Write([]byte("Hello"))
	}
}
