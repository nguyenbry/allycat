package places

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newTestApi returns a client pointed at ts for both Google endpoints, so no
// test in this package reaches the network.
func newTestApi(t *testing.T, ts *httptest.Server) *PlacesApi {
	t.Helper()

	api, err := NewPlacesApi("test-key")
	require.NoError(t, err)

	api.searchTextURL = ts.URL
	api.computeRoutesURL = ts.URL
	api.httpCli = ts.Client()

	return api
}

func TestNewPlacesApiRequiresKey(t *testing.T) {
	t.Parallel()

	api, err := NewPlacesApi("")

	assert.Error(t, err)
	assert.Nil(t, api)
}

func TestNewPlacesApiDefaults(t *testing.T) {
	t.Parallel()

	api, err := NewPlacesApi("abc")

	require.NoError(t, err)
	assert.Equal(t, "abc", api.apiKey)
	assert.NotNil(t, api.httpCli)
	assert.Equal(t, defaultSearchTextURL, api.searchTextURL)
	assert.Equal(t, defaultComputeRoutesURL, api.computeRoutesURL)
}

func TestTextSearchOptionsJson(t *testing.T) {
	t.Parallel()

	x := TextSearchOptions{Query: "test", LongLat: nil}

	val, err := json.Marshal(x)
	require.NoError(t, err)

	var parsed map[string]any
	require.NoError(t, json.Unmarshal(val, &parsed))

	// locationBias is omitempty, so a nil bias must not appear at all.
	assert.Len(t, parsed, 1)
	assert.Equal(t, "test", parsed["query"])
}

// --- googleAPIError -------------------------------------------------------

func TestGoogleAPIError(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		body string
		want string
	}{
		{
			name: "full envelope",
			body: `{"error":{"code":400,"message":"API key expired. Please renew the API key.","status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID"}]}}`,
			want: "API key expired. Please renew the API key. status=INVALID_ARGUMENT reason=API_KEY_INVALID",
		},
		{
			name: "message only",
			body: `{"error":{"message":"boom"}}`,
			want: "boom",
		},
		{
			name: "message and status",
			body: `{"error":{"message":"boom","status":"PERMISSION_DENIED"}}`,
			want: "boom status=PERMISSION_DENIED",
		},
		{
			name: "details without reason are skipped",
			body: `{"error":{"message":"boom","details":[{}]}}`,
			want: "boom",
		},
		{
			name: "multiple reasons",
			body: `{"error":{"message":"boom","details":[{"reason":"A"},{"reason":"B"}]}}`,
			want: "boom reason=A reason=B",
		},
		{
			name: "malformed json falls back to raw body",
			body: `not json at all`,
			want: "not json at all",
		},
		{
			name: "valid json with no error field falls back to raw body",
			body: `{"places":[]}`,
			want: `{"places":[]}`,
		},
		{
			name: "empty body",
			body: "",
			want: "",
		},
		{
			name: "whitespace is trimmed on fallback",
			body: "  oops\n",
			want: "oops",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			assert.Equal(t, tt.want, googleAPIError([]byte(tt.body)))
		})
	}
}

// --- TextSearch -----------------------------------------------------------

func TestTextSearchSendsExpectedRequest(t *testing.T) {
	t.Parallel()

	type captured struct {
		method    string
		apiKey    string
		fieldMask string
		conType   string
		body      map[string]any
	}

	var got captured

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)

		got.method = r.Method
		got.apiKey = r.Header.Get("X-Goog-Api-Key")
		got.fieldMask = r.Header.Get("X-Goog-FieldMask")
		got.conType = r.Header.Get("Content-Type")
		_ = json.Unmarshal(raw, &got.body)

		_, _ = w.Write([]byte(`{"places":[]}`))
	}))
	defer ts.Close()

	api := newTestApi(t, ts)

	_, err := api.TextSearch(context.Background(), TextSearchOptions{Query: "city hall"})
	require.NoError(t, err)

	assert.Equal(t, http.MethodPost, got.method)
	assert.Equal(t, "test-key", got.apiKey)
	assert.Equal(t, "application/json", got.conType)
	assert.Equal(t, "city hall", got.body["textQuery"])

	// Every field the response decoder depends on must be requested; Google
	// returns nothing that is not named in the mask.
	for _, want := range []string{
		"places.id",
		"places.formattedAddress",
		"places.googleMapsUri",
		"places.location",
		"places.displayName.text",
		"places.googleMapsLinks.directionsUri",
	} {
		assert.Contains(t, got.fieldMask, want)
	}
}

func TestTextSearchOmitsLocationBiasWhenAbsent(t *testing.T) {
	t.Parallel()

	var body map[string]any

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(raw, &body)
		_, _ = w.Write([]byte(`{"places":[]}`))
	}))
	defer ts.Close()

	api := newTestApi(t, ts)

	_, err := api.TextSearch(context.Background(), TextSearchOptions{Query: "x"})
	require.NoError(t, err)

	_, present := body["locationBias"]
	assert.False(t, present, "locationBias must be omitted when no base location is set")
}

func TestTextSearchSendsLocationBiasCircle(t *testing.T) {
	t.Parallel()

	var body map[string]any

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(raw, &body)
		_, _ = w.Write([]byte(`{"places":[]}`))
	}))
	defer ts.Close()

	api := newTestApi(t, ts)

	_, err := api.TextSearch(context.Background(), TextSearchOptions{
		Query:   "x",
		LongLat: &longLat{Long: -75.1634833, Lat: 39.9528},
	})
	require.NoError(t, err)

	bias, ok := body["locationBias"].(map[string]any)
	require.True(t, ok, "locationBias should be present")

	circle, ok := bias["circle"].(map[string]any)
	require.True(t, ok)

	center, ok := circle["center"].(map[string]any)
	require.True(t, ok)

	assert.InDelta(t, 39.9528, center["latitude"], 1e-9)
	assert.InDelta(t, -75.1634833, center["longitude"], 1e-9)

	// Google rejects anything above 50km.
	radius, ok := circle["radius"].(float64)
	require.True(t, ok)
	assert.Equal(t, 25000.0, radius)
	assert.LessOrEqual(t, radius, 50000.0)
}

func TestTextSearchParsesPlaces(t *testing.T) {
	t.Parallel()

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"places":[{
			"id":"place-1",
			"formattedAddress":"3000 Market St, Philadelphia, PA 19104, USA",
			"googleMapsUri":"https://maps.google.com/?cid=1",
			"displayName":{"text":"3000 Market St"},
			"googleMapsLinks":{"directionsUri":"https://maps.google.com/dir"},
			"location":{"latitude":39.9550555,"longitude":-75.1835133}
		}]}`))
	}))
	defer ts.Close()

	api := newTestApi(t, ts)

	res, err := api.TextSearch(context.Background(), TextSearchOptions{Query: "market"})
	require.NoError(t, err)
	require.Len(t, res, 1)

	p := res[0]
	assert.Equal(t, "place-1", p.Id)
	assert.Equal(t, "3000 Market St, Philadelphia, PA 19104, USA", p.FormattedAddress)
	assert.Equal(t, "3000 Market St", p.DisplayName.Name)
	assert.Equal(t, "https://maps.google.com/dir", p.Links.Directions)
	assert.InDelta(t, 39.9550555, p.Coordinates.Lat, 1e-9)
	assert.InDelta(t, -75.1835133, p.Coordinates.Long, 1e-9)
}

func TestTextSearchReturnsEmptySliceNotNil(t *testing.T) {
	t.Parallel()

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"places":[]}`))
	}))
	defer ts.Close()

	api := newTestApi(t, ts)

	res, err := api.TextSearch(context.Background(), TextSearchOptions{Query: "nothing"})
	require.NoError(t, err)
	assert.NotNil(t, res, "callers JSON-encode this directly; nil would serialise as null")
	assert.Empty(t, res)
}

func TestTextSearchSurfacesGoogleErrorMessage(t *testing.T) {
	t.Parallel()

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":{"code":400,"message":"API key expired. Please renew the API key.","status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID"}]}}`))
	}))
	defer ts.Close()

	api := newTestApi(t, ts)

	_, err := api.TextSearch(context.Background(), TextSearchOptions{Query: "x"})

	require.Error(t, err)
	// The whole point of reading the body: the reason must reach the operator.
	assert.Contains(t, err.Error(), "400")
	assert.Contains(t, err.Error(), "API key expired")
	assert.Contains(t, err.Error(), "API_KEY_INVALID")
}

func TestTextSearchErrorsOnMalformedJSON(t *testing.T) {
	t.Parallel()

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"places":`))
	}))
	defer ts.Close()

	api := newTestApi(t, ts)

	_, err := api.TextSearch(context.Background(), TextSearchOptions{Query: "x"})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unmarshalling")
}

func TestTextSearchHonoursContextCancellation(t *testing.T) {
	t.Parallel()

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"places":[]}`))
	}))
	defer ts.Close()

	api := newTestApi(t, ts)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err := api.TextSearch(ctx, TextSearchOptions{Query: "x"})
	assert.Error(t, err)
}

// --- payload construction -------------------------------------------------

func TestOptimizePayloadFromOptionsWithFixedEnd(t *testing.T) {
	t.Parallel()

	opts := optimizeRouteOptions{
		start: optimizeRouteLocation{id: "start"},
		end:   &optimizeRouteLocation{id: "end"},
		stops: []optimizeRouteLocation{{id: "a"}, {id: "b"}, {id: "c"}},
	}

	payloads, err := optimizePayloadFromOptions(opts)
	require.NoError(t, err)

	require.Len(t, payloads, 1, "a fixed end needs exactly one request")

	p := payloads[0]
	assert.Equal(t, "true", p.Optimize)
	assert.Equal(t, "start", p.Start.Id)
	assert.Equal(t, "end", p.End.Id)
	assert.Equal(t,
		[]optimizePayloadPlace{{Id: "a"}, {Id: "b"}, {Id: "c"}},
		p.Stops,
	)
}

func TestOptimizePayloadFromOptionsWithoutEndTriesEveryStop(t *testing.T) {
	t.Parallel()

	opts := optimizeRouteOptions{
		start: optimizeRouteLocation{id: "start"},
		stops: []optimizeRouteLocation{{id: "a"}, {id: "b"}, {id: "c"}},
	}

	payloads, err := optimizePayloadFromOptions(opts)
	require.NoError(t, err)

	require.Len(t, payloads, 3, "one candidate finish per stop")

	seenEnds := make([]string, 0, len(payloads))

	for _, p := range payloads {
		seenEnds = append(seenEnds, p.End.Id)

		assert.Equal(t, "start", p.Start.Id)
		assert.Len(t, p.Stops, 2, "the candidate finish must not also be an intermediate")

		for _, s := range p.Stops {
			assert.NotEqual(t, p.End.Id, s.Id)
		}
	}

	assert.ElementsMatch(t, []string{"a", "b", "c"}, seenEnds)
}

func TestOptimizePayloadPreservesRemainingStopOrder(t *testing.T) {
	t.Parallel()

	opts := optimizeRouteOptions{
		start: optimizeRouteLocation{id: "start"},
		stops: []optimizeRouteLocation{{id: "a"}, {id: "b"}, {id: "c"}},
	}

	payloads, err := optimizePayloadFromOptions(opts)
	require.NoError(t, err)

	byEnd := make(map[string][]optimizePayloadPlace)
	for _, p := range payloads {
		byEnd[p.End.Id] = p.Stops
	}

	// Excluding the middle element must keep the outer two in original order.
	assert.Equal(t, []optimizePayloadPlace{{Id: "a"}, {Id: "c"}}, byEnd["b"])
	assert.Equal(t, []optimizePayloadPlace{{Id: "b"}, {Id: "c"}}, byEnd["a"])
	assert.Equal(t, []optimizePayloadPlace{{Id: "a"}, {Id: "b"}}, byEnd["c"])
}

func TestAsBikeAndAsCarDoNotMutateReceiver(t *testing.T) {
	t.Parallel()

	base := optimizePayload{
		Optimize: "true",
		Start:    optimizePayloadPlace{Id: "s"},
		End:      optimizePayloadPlace{Id: "e"},
	}

	bike := base.asBike()
	car := base.asCar()

	assert.Nil(t, base.Avoids, "value receiver must leave the original untouched")
	assert.Empty(t, base.Vehicle)

	assert.Equal(t, "BICYCLE", bike.Vehicle)
	assert.Nil(t, bike.Avoids, "bikes are not affected by tolls or highways")

	assert.Equal(t, "DRIVE", car.Vehicle)
	require.NotNil(t, car.Avoids)
	assert.True(t, car.Avoids.Tolls)
	assert.True(t, car.Avoids.Highways)
}

func TestOptimizePayloadMarshalsTravelModeOnly(t *testing.T) {
	t.Parallel()

	// travelMode is omitempty; a naked payload must not send an empty string,
	// which Google rejects as an invalid enum value.
	raw, err := json.Marshal(optimizePayload{Optimize: "true"})
	require.NoError(t, err)

	var parsed map[string]any
	require.NoError(t, json.Unmarshal(raw, &parsed))

	_, hasTravelMode := parsed["travelMode"]
	assert.False(t, hasTravelMode)

	_, hasModifiers := parsed["routeModifiers"]
	assert.False(t, hasModifiers)
}

// --- builder validation ---------------------------------------------------

func TestOptimizeRouteBuilder(t *testing.T) {
	t.Parallel()

	valid := func() optimizeRouteOptionsBuilder {
		return NewOptimizeRoutePayloadBuilder().
			WithStart("start", 1, 2).
			AddStop("a", 3, 4).
			AddStop("b", 5, 6)
	}

	t.Run("valid without end", func(t *testing.T) {
		t.Parallel()

		opts, err := valid().Build()
		require.NoError(t, err)
		assert.Equal(t, "start", opts.start.id)
		assert.Nil(t, opts.end)
		assert.Len(t, opts.stops, 2)
	})

	t.Run("valid with end", func(t *testing.T) {
		t.Parallel()

		opts, err := valid().WithEnd("end", 7, 8).Build()
		require.NoError(t, err)
		require.NotNil(t, opts.end)
		assert.Equal(t, "end", opts.end.id)
	})

	t.Run("missing start", func(t *testing.T) {
		t.Parallel()

		_, err := NewOptimizeRoutePayloadBuilder().
			AddStop("a", 1, 2).
			AddStop("b", 3, 4).
			Build()

		require.Error(t, err)
		assert.Contains(t, err.Error(), "start")
	})

	t.Run("fewer than two stops", func(t *testing.T) {
		t.Parallel()

		_, err := NewOptimizeRoutePayloadBuilder().
			WithStart("start", 1, 2).
			AddStop("a", 3, 4).
			Build()

		require.Error(t, err)
		assert.Contains(t, err.Error(), "two stops")
	})

	t.Run("stop with empty id", func(t *testing.T) {
		t.Parallel()

		_, err := NewOptimizeRoutePayloadBuilder().
			WithStart("start", 1, 2).
			AddStop("a", 3, 4).
			AddStop("", 5, 6).
			Build()

		require.Error(t, err)
		assert.Contains(t, err.Error(), "index 1")
	})

	t.Run("end with empty id", func(t *testing.T) {
		t.Parallel()

		_, err := valid().WithEnd("", 7, 8).Build()

		require.Error(t, err)
		assert.Contains(t, err.Error(), "end")
	})
}

func TestBuilderStoresLatLongInCorrectFields(t *testing.T) {
	t.Parallel()

	// WithStart/AddStop/WithEnd all take (id, lat, long) but store
	// {id, long, lat} — a swap here silently corrupts every coordinate.
	opts, err := NewOptimizeRoutePayloadBuilder().
		WithStart("s", 10, 20).
		AddStop("a", 30, 40).
		AddStop("b", 50, 60).
		WithEnd("e", 70, 80).
		Build()

	require.NoError(t, err)

	assert.Equal(t, 10.0, opts.start.lat)
	assert.Equal(t, 20.0, opts.start.long)
	assert.Equal(t, 30.0, opts.stops[0].lat)
	assert.Equal(t, 40.0, opts.stops[0].long)
	assert.Equal(t, 70.0, opts.end.lat)
	assert.Equal(t, 80.0, opts.end.long)
}

// --- OptimizeRoute --------------------------------------------------------

// routesHandler answers computeRoutes, using travelMode to vary the distance
// so bike and car results can be told apart.
func routesHandler(t *testing.T, distanceByMode map[string]int64) http.HandlerFunc {
	t.Helper()

	return func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)

		var body struct {
			Vehicle       string                 `json:"travelMode"`
			Intermediates []optimizePayloadPlace `json:"intermediates"`
		}
		_ = json.Unmarshal(raw, &body)

		// Reverse the caller's order so the id mapping is actually exercised.
		order := make([]int, 0, len(body.Intermediates))
		for i := len(body.Intermediates) - 1; i >= 0; i-- {
			order = append(order, i)
		}

		resp := map[string]any{
			"routes": []map[string]any{{
				"distanceMeters":                    distanceByMode[body.Vehicle],
				"optimizedIntermediateWaypointIndex": order,
				"localizedValues": map[string]any{
					"distance": map[string]any{"text": "1.0 mi"},
					"duration": map[string]any{"text": "10 mins"},
				},
			}},
		}

		_ = json.NewEncoder(w).Encode(resp)
	}
}

func TestOptimizeRouteMapsWaypointIndexesToPlaceIds(t *testing.T) {
	t.Parallel()

	ts := httptest.NewServer(routesHandler(t, map[string]int64{
		"BICYCLE": 1000,
		"DRIVE":   2000,
	}))
	defer ts.Close()

	api := newTestApi(t, ts)

	opts, err := NewOptimizeRoutePayloadBuilder().
		WithStart("start", 1, 1).
		AddStop("a", 2, 2).
		AddStop("b", 3, 3).
		WithEnd("end", 4, 4).
		Build()
	require.NoError(t, err)

	routes, err := api.OptimizeRoute(context.Background(), opts)
	require.NoError(t, err)
	require.Len(t, routes, 1, "a fixed end yields one destination")

	got := routes[0]
	assert.Equal(t, "end", got.End)

	require.NotNil(t, got.BikeRoute)
	require.NotNil(t, got.CarRoute)

	// The stub reverses the order, so ids must come back reversed too.
	assert.Equal(t, []string{"b", "a"}, got.BikeRoute.Order)
	assert.Equal(t, int64(1000), got.BikeRoute.Meters)
	assert.Equal(t, int64(2000), got.CarRoute.Meters)
	assert.Equal(t, "1.0 mi", got.BikeRoute.DisplayDistance)
	assert.Equal(t, "10 mins", got.BikeRoute.DisplayDuration)
}

func TestOptimizeRouteWithoutEndReturnsOnePerCandidate(t *testing.T) {
	t.Parallel()

	ts := httptest.NewServer(routesHandler(t, map[string]int64{
		"BICYCLE": 1000,
		"DRIVE":   2000,
	}))
	defer ts.Close()

	api := newTestApi(t, ts)

	opts, err := NewOptimizeRoutePayloadBuilder().
		WithStart("start", 1, 1).
		AddStop("a", 2, 2).
		AddStop("b", 3, 3).
		AddStop("c", 4, 4).
		Build()
	require.NoError(t, err)

	routes, err := api.OptimizeRoute(context.Background(), opts)
	require.NoError(t, err)

	require.Len(t, routes, 3)

	ends := make([]string, 0, len(routes))
	for _, r := range routes {
		ends = append(ends, r.End)
		assert.NotNil(t, r.BikeRoute)
		assert.NotNil(t, r.CarRoute)
	}

	assert.ElementsMatch(t, []string{"a", "b", "c"}, ends)
}

func TestOptimizeRouteKeepsShortestPerDestination(t *testing.T) {
	t.Parallel()

	// Return two routes for the same request with different distances; only
	// the shorter one should survive.
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)

		var body struct {
			Intermediates []optimizePayloadPlace `json:"intermediates"`
		}
		_ = json.Unmarshal(raw, &body)

		idx := make([]int, len(body.Intermediates))
		for i := range idx {
			idx[i] = i
		}

		_ = json.NewEncoder(w).Encode(map[string]any{
			"routes": []map[string]any{
				{
					"distanceMeters":                    9000,
					"optimizedIntermediateWaypointIndex": idx,
					"localizedValues": map[string]any{
						"distance": map[string]any{"text": "long"},
						"duration": map[string]any{"text": "slow"},
					},
				},
				{
					"distanceMeters":                    100,
					"optimizedIntermediateWaypointIndex": idx,
					"localizedValues": map[string]any{
						"distance": map[string]any{"text": "short"},
						"duration": map[string]any{"text": "fast"},
					},
				},
			},
		})
	}))
	defer ts.Close()

	api := newTestApi(t, ts)

	opts, err := NewOptimizeRoutePayloadBuilder().
		WithStart("start", 1, 1).
		AddStop("a", 2, 2).
		AddStop("b", 3, 3).
		WithEnd("end", 4, 4).
		Build()
	require.NoError(t, err)

	routes, err := api.OptimizeRoute(context.Background(), opts)
	require.NoError(t, err)
	require.Len(t, routes, 1)

	require.NotNil(t, routes[0].BikeRoute)
	assert.Equal(t, int64(100), routes[0].BikeRoute.Meters)
	assert.Equal(t, "short", routes[0].BikeRoute.DisplayDistance)
}

func TestOptimizeRouteRejectsOutOfRangeWaypointIndex(t *testing.T) {
	t.Parallel()

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"routes":[{"distanceMeters":10,"optimizedIntermediateWaypointIndex":[99],"localizedValues":{}}]}`))
	}))
	defer ts.Close()

	api := newTestApi(t, ts)

	opts, err := NewOptimizeRoutePayloadBuilder().
		WithStart("start", 1, 1).
		AddStop("a", 2, 2).
		AddStop("b", 3, 3).
		WithEnd("end", 4, 4).
		Build()
	require.NoError(t, err)

	_, err = api.OptimizeRoute(context.Background(), opts)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "idx 99")
}

func TestOptimizeRouteSurfacesGoogleErrorMessage(t *testing.T) {
	t.Parallel()

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte(`{"error":{"message":"Routes API has not been used","status":"PERMISSION_DENIED","details":[{"reason":"SERVICE_DISABLED"}]}}`))
	}))
	defer ts.Close()

	api := newTestApi(t, ts)

	opts, err := NewOptimizeRoutePayloadBuilder().
		WithStart("start", 1, 1).
		AddStop("a", 2, 2).
		AddStop("b", 3, 3).
		WithEnd("end", 4, 4).
		Build()
	require.NoError(t, err)

	_, err = api.OptimizeRoute(context.Background(), opts)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "403")
	assert.Contains(t, err.Error(), "Routes API has not been used")
	assert.Contains(t, err.Error(), "SERVICE_DISABLED")
}

func TestOptimizeRouteSendsBothVehicleVariants(t *testing.T) {
	t.Parallel()

	seenModes := make(chan string, 16)

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)

		var body struct {
			Vehicle       string                 `json:"travelMode"`
			Modifiers     *optimizePayloadAvoids `json:"routeModifiers"`
			Intermediates []optimizePayloadPlace `json:"intermediates"`
		}
		_ = json.Unmarshal(raw, &body)

		seenModes <- body.Vehicle

		if body.Vehicle == "BICYCLE" {
			assert.Nil(t, body.Modifiers, "bike requests must not send car-only modifiers")
		}

		idx := make([]int, len(body.Intermediates))
		for i := range idx {
			idx[i] = i
		}

		_ = json.NewEncoder(w).Encode(map[string]any{
			"routes": []map[string]any{{
				"distanceMeters":                    10,
				"optimizedIntermediateWaypointIndex": idx,
				"localizedValues":                    map[string]any{},
			}},
		})
	}))
	defer ts.Close()

	api := newTestApi(t, ts)

	opts, err := NewOptimizeRoutePayloadBuilder().
		WithStart("start", 1, 1).
		AddStop("a", 2, 2).
		AddStop("b", 3, 3).
		WithEnd("end", 4, 4).
		Build()
	require.NoError(t, err)

	_, err = api.OptimizeRoute(context.Background(), opts)
	require.NoError(t, err)

	close(seenModes)

	counts := map[string]int{}
	for v := range seenModes {
		counts[v]++
	}

	assert.Equal(t, 1, counts["BICYCLE"])
	assert.Equal(t, 1, counts["DRIVE"])
}

// --- live smoke tests -----------------------------------------------------

// liveApi returns a real client, or skips when no key is configured, so the
// offline suite above still runs in CI.
func liveApi(t *testing.T) *PlacesApi {
	t.Helper()

	key, ok := os.LookupEnv("MAPS_API_KEY")
	if !ok || key == "" {
		t.Skip("MAPS_API_KEY not set; skipping live Google API test")
	}

	api, err := NewPlacesApi(key)
	require.NoError(t, err)

	return api
}

func TestLiveTextSearch(t *testing.T) {
	api := liveApi(t)

	res, err := api.TextSearch(context.Background(), TextSearchOptions{
		Query: "3000 Market St Philadelphia",
	})
	require.NoError(t, err)
	require.NotEmpty(t, res)

	// Guards the field mask against Google dropping or renaming a field.
	first := res[0]
	assert.NotEmpty(t, first.Id)
	assert.NotEmpty(t, first.FormattedAddress)
	assert.NotEmpty(t, first.DisplayName.Name)
	assert.NotEmpty(t, first.Links.Directions)
	assert.NotZero(t, first.Coordinates.Lat)
	assert.NotZero(t, first.Coordinates.Long)
}
