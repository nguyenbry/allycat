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
		WriteJSONResponse(w, NewResponse().WithMessage(fmt.Sprintf("Error decoding request body: %v", err)), http.StatusBadRequest)
	}

	if len(reqBody.Query) < 4 {
		WriteJSONResponse(w, NewResponse().WithMessage("Query must be at least 4 characters long"), http.StatusBadRequest)
		return
	}

	fmt.Println("Received text search query:", reqBody.Query)

	res, err := h.api.TextSearch(reqBody)

	if err != nil {
		WriteJSONResponse(w, NewResponse().WithMessage(fmt.Sprintf("Error searching places: %v", err)), http.StatusInternalServerError)
	} else {
		WriteJSONResponse(w, NewResponse().WithData(res), http.StatusOK)
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
		WriteJSONResponse(w, NewResponse().WithMessage("Invalid payload"), http.StatusBadRequest)
		return
	} else if reqBody.Start == "" {
		WriteJSONResponse(w, NewResponse().WithMessage("Start location is required"), http.StatusBadRequest)
		return
	} else if len(reqBody.Stops) < 2 {
		WriteJSONResponse(w, NewResponse().WithMessage("At least two stops are required"), http.StatusBadRequest)
		return
	} else if reqBody.End != nil && *reqBody.End == "" {
		WriteJSONResponse(w, NewResponse().WithMessage("Destination is empty"), http.StatusBadRequest)
		return
	}

	payload := places.
		NewOptimizeRoutePayloadBuilder().
		WithStart(reqBody.Start).
		WithStops(reqBody.Stops).WithEnd(reqBody.End)

	routes, err := h.api.OptimizeRoute(payload)

	if err != nil {
		fmt.Printf("error occurred during 'OptimizeRoute': %v\n", err.Error())
		writeServerError(w)
	} else {
		WriteJSONResponse(w, NewResponse().WithData(routes), http.StatusOK)
	}
}
