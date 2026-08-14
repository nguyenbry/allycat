package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/nguyen/allycat/internal/places"
	"github.com/nguyen/allycat/internal/tsp"
)

const (
	// A single text search is one upstream call, normally well under a second,
	// but there is no fallback if it fails — so give a slow network room
	// rather than showing "no results" for what is really a timeout.
	textSearchTimeout = 5 * time.Second

	// Route optimization fans out one Google request per candidate finish, per
	// vehicle — a ten-stop sheet with no fixed end is twenty concurrent calls.
	// The local solver already answers instantly, so this budget only decides
	// how long to wait before falling back to solver-only.
	optimizeRouteTimeout = 8 * time.Second

	// Measuring an already-decided order is a single upstream call. It only
	// enriches a route the rider already has, so it fails fast rather than
	// holding the connection open.
	routeLegsTimeout = 8 * time.Second
)

type PlacesHandler struct {
	api *places.PlacesApi
}

// NewPlacesHandler takes the constructed client rather than an API key so the
// handler has no opinion on how that client is built or pointed.
func NewPlacesHandler(api *places.PlacesApi) PlacesHandler {
	return PlacesHandler{
		api: api,
	}
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

	googleMethodContext, cancel := context.WithTimeout(r.Context(), textSearchTimeout)
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
		builder = builder.WithEnd(b.End.Id, *b.End.Lat, *b.End.Long)
	}

	for _, s := range b.Stops {
		builder = builder.AddStop(s.Id, *s.Lat, *s.Long)
	}

	payload, err := builder.Build()

	if err != nil {
		WriteJSONResponse(w, NewResponse().WithMessage(err.Error()), http.StatusBadRequest)
		return
	}

	googleMethodContext, cancel := context.WithTimeout(r.Context(), optimizeRouteTimeout)
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
			log.Printf("route optimization failed, falling back to solver only: %v", err)
		} else {
			allRoutes = append(allRoutes, result.Result...)
		}
	case <-googleMethodContext.Done():
		log.Println("route optimization timed out, falling back to solver only")
	}

	WriteJSONResponse(w, NewResponse().WithData(allRoutes), http.StatusOK)
}

// HandleRouteLegs measures a route whose order the caller already decided, and
// returns the real road distance of each hop.
//
// This exists because the solver reports straight-line distance, which is a
// rough estimate. The client enriches a displayed route with these numbers
// after the fact, so a failure here degrades the display without costing the
// rider their route.
func (h PlacesHandler) HandleRouteLegs(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Origin      string   `json:"origin"`
		Stops       []string `json:"stops"`
		Destination string   `json:"destination"`
		ByCar       bool     `json:"byCar"`
	}

	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		WriteJSONResponse(w, NewResponse().WithMessage("Invalid payload"), http.StatusBadRequest)
		return
	}

	opts := places.RouteLegsOptions{
		Origin:      b.Origin,
		Stops:       b.Stops,
		Destination: b.Destination,
		ByCar:       b.ByCar,
	}

	googleMethodContext, cancel := context.WithTimeout(r.Context(), routeLegsTimeout)
	defer cancel()

	res, err := h.api.RouteLegs(googleMethodContext, opts)

	if err != nil {
		// Validation problems are the caller's fault; anything else is ours or
		// Google's, and the client treats both the same way — it just skips
		// the enrichment.
		if errors.Is(err, context.DeadlineExceeded) {
			log.Printf("route legs timed out: %v", err)
			WriteJSONResponse(w, NewResponse().WithMessage("Timed out measuring the route"), http.StatusGatewayTimeout)
			return
		}

		log.Printf("route legs failed: %v", err)
		WriteJSONResponse(w, NewResponse().WithMessage(err.Error()), http.StatusBadRequest)
		return
	}

	WriteJSONResponse(w, NewResponse().WithData(res), http.StatusOK)
}
