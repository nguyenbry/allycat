package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/nguyen/allycat/internal/places"
	"github.com/nguyen/allycat/internal/tsp"
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
	var reqBody places.TextSearchOptions

	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		WriteJSONResponse(w, NewResponse().WithMessage(fmt.Sprintf("Error decoding request body: %v", err)), http.StatusBadRequest)
	}

	if len(reqBody.Query) < 4 {
		WriteJSONResponse(w, NewResponse().WithMessage("Query must be at least 4 characters long"), http.StatusBadRequest)
		return
	}

	fmt.Println("Received text search query:", reqBody.Query)

	googleMethodContext, cancel := context.WithTimeout(r.Context(), time.Second*2)
	defer cancel()
	res, err := h.api.TextSearch(googleMethodContext, reqBody)

	if err != nil {
		WriteJSONResponse(w, NewResponse().WithMessage(fmt.Sprintf("Error searching places: %v", err)), http.StatusInternalServerError)
	} else {
		WriteJSONResponse(w, NewResponse().WithData(res), http.StatusOK)
	}
}

type optimizeRoutePayloadPlace struct {
	Id   string   `json:"id"`
	Long *float64 `json:"longitude"` // using * because 0 is a valid value
	Lat  *float64 `json:"latitude"`
}

func (o optimizeRoutePayloadPlace) validate() error {
	if o.Id == "" {
		return errors.New("'id' is required")
	}

	if o.Lat == nil {
		return errors.New("'latitude' is required")
	}

	if o.Long == nil {
		return errors.New("'longitude' is required")
	}

	return nil
}

func (h PlacesHandler) HandleOptimizeRoute(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Start optimizeRoutePayloadPlace   `json:"origin"`
		Stops []optimizeRoutePayloadPlace `json:"stops"`
		End   *optimizeRoutePayloadPlace  `json:"destination"`
	}

	// if err := json.Unmarshal([]byte(testStr), &reqBody); err != nil {
	// 	writeJSONResponse(w, newResponse().message("Invalid payload"), http.StatusBadRequest)
	// 	return
	// }
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		WriteJSONResponse(w, NewResponse().WithMessage("Invalid payload"), http.StatusBadRequest)
		return
	}

	if err := b.Start.validate(); err != nil {
		WriteJSONResponse(w, NewResponse().WithMessage(fmt.Sprintf("start %s", err.Error())), http.StatusBadRequest)
		return
	}

	if b.End != nil {
		if err := b.End.validate(); err != nil {
			WriteJSONResponse(w, NewResponse().WithMessage(fmt.Sprintf("end %s", err.Error())), http.StatusBadRequest)
			return
		}
	}

	for i, s := range b.Stops {
		if err := s.validate(); err != nil {
			WriteJSONResponse(w, NewResponse().WithMessage(fmt.Sprintf("stop at index %d %s", i, err.Error())), http.StatusBadRequest)
			return
		}
	}

	if len(b.Stops) < 2 {
		WriteJSONResponse(w, NewResponse().WithMessage("At least two stops are required"), http.StatusBadRequest)
		return
	}

	builder := places.
		NewOptimizeRoutePayloadBuilder().
		WithStart(b.Start.Id, *b.Start.Lat, *b.Start.Long)

	if b.End != nil {
		builder = builder.WithEnd(b.End.Id, *b.Start.Lat, *b.End.Long)
	}

	for _, s := range b.Stops {
		builder = builder.AddStop(s.Id, *s.Lat, *s.Long)
	}

	payload, err := builder.Build()

	if err != nil {
		WriteJSONResponse(w, NewResponse().WithMessage(err.Error()), http.StatusBadRequest)
		return
	}

	googleMethodContext, cancel := context.WithTimeout(r.Context(), time.Second*3)
	defer cancel()

	type apiRes struct {
		Result []places.OptimalRoute
		Err    error
	}
	ch := make(chan apiRes, 1)
	go func() {
		routes, err := h.api.OptimizeRoute(googleMethodContext, payload)
		ch <- apiRes{routes, err}
	}()

	tspRoute := func() places.OptimalRoute {
		// test manual tsp
		tb := tsp.NewTspRouteBuilder()
		tb = tb.WithStart(b.Start.Id, *b.Start.Lat, *b.Start.Long)

		if b.End != nil {
			tb = tb.WithEnd(b.End.Id, *b.End.Lat, *b.End.Long)
		}

		for _, s := range b.Stops {
			tb = tb.AddStop(s.Id, *s.Lat, *s.Long)
		}

		or := tb.Build().OptimalRoutes()

		stopIds := make([]string, 0, len(or.Stops))

		for _, s := range or.Stops {
			stopIds = append(stopIds, s.Id)
		}

		return places.OptimalRoute{
			Method: "tsp",
			End:    or.End.Id,
			BikeRoute: &places.OptimizeRouteResponse{
				Meters:          int64(or.Meters),
				DisplayDistance: fmt.Sprintf("%.1f mi", or.Meters/1609.344),
				DisplayDuration: "idk2",
				Order:           stopIds,
			},
			CarRoute: nil,
		}
	}()

	allRoutes := []places.OptimalRoute{tspRoute}

	select {
	case result := <-ch:
		if err := result.Err; err != nil {
			fmt.Printf("API failed, using TSP fallback: %v", result.Err)
		} else {
			allRoutes = append(allRoutes, result.Result...)
		}
	case <-googleMethodContext.Done():
		fmt.Println("API calc timed out 😔")
	}

	WriteJSONResponse(w, NewResponse().WithData(allRoutes), http.StatusOK)
}
