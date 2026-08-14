//go:build integration

// Package integration exercises the real Google Places and Routes APIs end to
// end, the same way the app does: anchor searches to a base location, resolve
// bare street addresses off a race sheet, then optimise the resulting stops.
//
// These are excluded from the normal suite because they cost money and need a
// live key. Run them with:
//
//	MAPS_API_KEY=... go test -tags=integration ./internal/integration/...
package integration

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/nguyen/allycat/internal/http_server/handlers"
	"github.com/nguyen/allycat/internal/places"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// philadelphiaCityHall is the base location for every test here — exactly how
// the app is used, where city hall anchors searches to the right metro.
const philadelphiaCityHall = "Philadelphia City Hall"

type resolvedPlace struct {
	Id               string `json:"id"`
	FormattedAddress string `json:"formattedAddress"`
	DisplayName      struct {
		Text string `json:"text"`
	} `json:"displayName"`
	Location struct {
		Lat  float64 `json:"latitude"`
		Long float64 `json:"longitude"`
	} `json:"location"`
}

type routeResult struct {
	Method      string `json:"method"`
	Destination string `json:"destination"`
	Bike        *struct {
		Order           []string `json:"order"`
		Meters          int64    `json:"meters"`
		DisplayDistance string   `json:"displayDistance"`
		DisplayDuration string   `json:"displayDuration"`
	} `json:"bike"`
	Car *struct {
		Order  []string `json:"order"`
		Meters int64    `json:"meters"`
	} `json:"car"`
}

func liveHandler(t *testing.T) handlers.PlacesHandler {
	t.Helper()

	key, ok := os.LookupEnv("MAPS_API_KEY")
	if !ok || key == "" {
		t.Skip("MAPS_API_KEY not set; skipping live integration test")
	}

	api, err := places.NewPlacesApi(key)
	require.NoError(t, err)

	return handlers.NewPlacesHandler(api)
}

type latLong struct {
	Lat  float64
	Long float64
}

// search runs one text search through the real HTTP handler, optionally biased.
func search(t *testing.T, h handlers.PlacesHandler, query string, bias *latLong) []resolvedPlace {
	t.Helper()

	payload := map[string]any{"query": query}
	if bias != nil {
		payload["locationBias"] = map[string]float64{
			"latitude":  bias.Lat,
			"longitude": bias.Long,
		}
	}

	raw, err := json.Marshal(payload)
	require.NoError(t, err)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/places/search", strings.NewReader(string(raw)))

	h.HandleTextSearch(rec, req)

	var body struct {
		Message *string         `json:"message"`
		Data    json.RawMessage `json:"data"`
	}
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&body))

	if rec.Code != http.StatusOK {
		msg := ""
		if body.Message != nil {
			msg = *body.Message
		}
		t.Fatalf("search %q failed with %d: %s", query, rec.Code, msg)
	}

	var found []resolvedPlace
	require.NoError(t, json.Unmarshal(body.Data, &found))

	return found
}

// resolveOne picks the top hit, mirroring what a rider does when typing an
// address off the sheet and tapping the first result.
func resolveOne(t *testing.T, h handlers.PlacesHandler, query string, bias *latLong) resolvedPlace {
	t.Helper()

	found := search(t, h, query, bias)
	require.NotEmpty(t, found, "no results for %q", query)

	return found[0]
}

func optimize(t *testing.T, h handlers.PlacesHandler, origin resolvedPlace, stops []resolvedPlace, destination *resolvedPlace) []routeResult {
	t.Helper()

	asPlace := func(p resolvedPlace) map[string]any {
		return map[string]any{
			"id":        p.Id,
			"latitude":  p.Location.Lat,
			"longitude": p.Location.Long,
		}
	}

	payload := map[string]any{"origin": asPlace(origin)}

	stopPayload := make([]map[string]any, 0, len(stops))
	for _, s := range stops {
		stopPayload = append(stopPayload, asPlace(s))
	}
	payload["stops"] = stopPayload

	if destination != nil {
		payload["destination"] = asPlace(*destination)
	}

	raw, err := json.Marshal(payload)
	require.NoError(t, err)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/places/optimize", strings.NewReader(string(raw)))

	h.HandleOptimizeRoute(rec, req)

	var body struct {
		Message *string         `json:"message"`
		Data    json.RawMessage `json:"data"`
	}
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&body))

	if rec.Code != http.StatusOK {
		msg := ""
		if body.Message != nil {
			msg = *body.Message
		}
		t.Fatalf("optimize failed with %d: %s", rec.Code, msg)
	}

	var routes []routeResult
	require.NoError(t, json.Unmarshal(body.Data, &routes))

	return routes
}

// names maps place ids back to human labels so a golden mismatch is readable.
func names(byId map[string]string, ids []string) []string {
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		if n, ok := byId[id]; ok {
			out = append(out, n)
		} else {
			out = append(out, "unknown:"+id)
		}
	}
	return out
}

func solverRoute(t *testing.T, routes []routeResult) routeResult {
	t.Helper()

	for _, r := range routes {
		if r.Method == "tsp" {
			return r
		}
	}

	t.Fatal("no solver route in response")
	return routeResult{}
}

// --- base location behaviour ---------------------------------------------

// TestBaseLocationDisambiguatesBareAddresses is the core reason base location
// exists: a street address with no city must land in the anchored metro.
func TestBaseLocationDisambiguatesBareAddresses(t *testing.T) {
	h := liveHandler(t)

	cityHall := resolveOne(t, h, philadelphiaCityHall, nil)
	require.Contains(t, cityHall.FormattedAddress, "Philadelphia")

	bias := &latLong{Lat: cityHall.Location.Lat, Long: cityHall.Location.Long}

	// Bare addresses, exactly as they appear on a race sheet.
	for _, addr := range []string{
		"3000 Market St",
		"4900 Baltimore Ave",
		"3939 Lancaster Ave",
		"2201 Christian St",
	} {
		t.Run(addr, func(t *testing.T) {
			got := resolveOne(t, h, addr, bias)

			assert.Contains(t, got.FormattedAddress, "Philadelphia",
				"%q resolved outside the anchored city: %s", addr, got.FormattedAddress)

			// Sanity-check the coordinates are actually in the Philadelphia box.
			assert.InDelta(t, 39.99, got.Location.Lat, 0.15)
			assert.InDelta(t, -75.16, got.Location.Long, 0.15)
		})
	}
}

func TestBaseLocationIsHonouredForAmbiguousNames(t *testing.T) {
	h := liveHandler(t)

	cityHall := resolveOne(t, h, philadelphiaCityHall, nil)
	bias := &latLong{Lat: cityHall.Location.Lat, Long: cityHall.Location.Long}

	// "Market Street" exists in many cities; anchored, it must be the local one.
	got := resolveOne(t, h, "Market Street", bias)

	assert.InDelta(t, 39.95, got.Location.Lat, 0.25,
		"biased search drifted out of the metro: %s", got.FormattedAddress)
}

// --- full route regression ------------------------------------------------

// raceSheet is a fixed set of Philadelphia stops standing in for the paper
// handed out at the start of a race.
var raceSheet = []string{
	"3000 Market St",
	"9 Boathouse Row",
	"4900 Baltimore Ave",
	"3939 Lancaster Ave",
	"2201 Christian St",
	"1300 McKean St",
	"422 Walnut St",
}

const (
	raceOrigin      = "Philadelphia Museum of Art"
	raceDestination = "1500 Market St"
)

// TestFixedDestinationRouteIsStable pins the ordering the solver produces for
// a known sheet, so a future change to the solver or the projection is caught.
func TestFixedDestinationRouteIsStable(t *testing.T) {
	h := liveHandler(t)

	cityHall := resolveOne(t, h, philadelphiaCityHall, nil)
	bias := &latLong{Lat: cityHall.Location.Lat, Long: cityHall.Location.Long}

	origin := resolveOne(t, h, raceOrigin, bias)
	destination := resolveOne(t, h, raceDestination, bias)

	stops := make([]resolvedPlace, 0, len(raceSheet))
	byId := map[string]string{
		origin.Id:      raceOrigin,
		destination.Id: raceDestination,
	}

	for _, addr := range raceSheet {
		p := resolveOne(t, h, addr, bias)
		stops = append(stops, p)
		byId[p.Id] = addr
	}

	require.Len(t, stops, len(raceSheet))

	routes := optimize(t, h, origin, stops, &destination)
	require.NotEmpty(t, routes)

	solver := solverRoute(t, routes)

	require.NotNil(t, solver.Bike)
	assert.Equal(t, destination.Id, solver.Destination, "a fixed destination must be honoured")

	order := names(byId, solver.Bike.Order)

	t.Logf("solver order: %v (%d m)", order, solver.Bike.Meters)

	// Structural guarantees: every stop exactly once, and neither endpoint
	// smuggled into the middle of the route.
	assert.ElementsMatch(t, raceSheet, order,
		"every stop on the sheet must appear exactly once")
	assert.NotContains(t, solver.Bike.Order, origin.Id)
	assert.NotContains(t, solver.Bike.Order, destination.Id)

	// Golden ordering. If this changes, the routing behaviour changed —
	// confirm it is an improvement before updating.
	assert.Equal(t, []string{
		"9 Boathouse Row",
		"3939 Lancaster Ave",
		"4900 Baltimore Ave",
		"3000 Market St",
		"2201 Christian St",
		"1300 McKean St",
		"422 Walnut St",
	}, order)

	// Recorded 2026-08-14 at 17499 m. The band absorbs Google nudging a
	// geocode by a few metres without hiding a real routing regression.
	assert.InDelta(t, 17499, solver.Bike.Meters, 2000,
		"route length drifted far outside the expected band")
}

// TestVariableDestinationPicksAStopAsFinish covers the other mode: no fixed
// finish, so every stop is tried as the last one.
func TestVariableDestinationPicksAStopAsFinish(t *testing.T) {
	h := liveHandler(t)

	cityHall := resolveOne(t, h, philadelphiaCityHall, nil)
	bias := &latLong{Lat: cityHall.Location.Lat, Long: cityHall.Location.Long}

	origin := resolveOne(t, h, raceOrigin, bias)

	// A smaller sheet: without a fixed finish this fans out one Google
	// request per candidate, per vehicle.
	sheet := raceSheet[:5]

	stops := make([]resolvedPlace, 0, len(sheet))
	byId := map[string]string{origin.Id: raceOrigin}

	for _, addr := range sheet {
		p := resolveOne(t, h, addr, bias)
		stops = append(stops, p)
		byId[p.Id] = addr
	}

	routes := optimize(t, h, origin, stops, nil)
	require.NotEmpty(t, routes)

	solver := solverRoute(t, routes)
	require.NotNil(t, solver.Bike)

	finish, ok := byId[solver.Destination]
	require.True(t, ok, "finish must be one of the stops")
	assert.Contains(t, sheet, finish)

	order := names(byId, solver.Bike.Order)

	t.Logf("solver picked finish %q, order: %v (%d m)", finish, order, solver.Bike.Meters)

	// The finish is not also an intermediate, and the two together cover the
	// whole sheet exactly once.
	assert.NotContains(t, order, finish)
	assert.Len(t, order, len(sheet)-1)
	assert.ElementsMatch(t, sheet, append(append([]string{}, order...), finish))

	// Golden: which stop the solver chooses to end at, and in what order.
	// Recorded 2026-08-14 at 9826 m.
	assert.Equal(t, "4900 Baltimore Ave", finish)
	assert.Equal(t, []string{
		"9 Boathouse Row",
		"3939 Lancaster Ave",
		"3000 Market St",
		"2201 Christian St",
	}, order)
	assert.InDelta(t, 9826, solver.Bike.Meters, 1500)
}

// TestGoogleRoutesAgreeWithSolverOnCoverage checks the upstream result covers
// the same stops, without pinning Google's ordering — that is theirs to change.
func TestGoogleRoutesAgreeWithSolverOnCoverage(t *testing.T) {
	h := liveHandler(t)

	cityHall := resolveOne(t, h, philadelphiaCityHall, nil)
	bias := &latLong{Lat: cityHall.Location.Lat, Long: cityHall.Location.Long}

	origin := resolveOne(t, h, raceOrigin, bias)
	destination := resolveOne(t, h, raceDestination, bias)

	sheet := raceSheet[:5]

	stops := make([]resolvedPlace, 0, len(sheet))
	byId := map[string]string{}

	for _, addr := range sheet {
		p := resolveOne(t, h, addr, bias)
		stops = append(stops, p)
		byId[p.Id] = addr
	}

	routes := optimize(t, h, origin, stops, &destination)

	var google *routeResult
	for i := range routes {
		if routes[i].Method == "" {
			google = &routes[i]
			break
		}
	}

	if google == nil {
		t.Skip("Google did not answer within the handler timeout; solver-only response")
	}

	require.NotNil(t, google.Bike, "expected a bike route from Google")

	assert.Equal(t, destination.Id, google.Destination)
	assert.ElementsMatch(t, sheet, names(byId, google.Bike.Order))
	assert.Positive(t, google.Bike.Meters)
	assert.NotEmpty(t, google.Bike.DisplayDistance)
	assert.NotEmpty(t, google.Bike.DisplayDuration)

	if google.Car != nil {
		assert.ElementsMatch(t, sheet, names(byId, google.Car.Order))
		assert.Positive(t, google.Car.Meters)
	}

	fmt.Printf("google bike: %s / %s\n", google.Bike.DisplayDistance, google.Bike.DisplayDuration)
}
