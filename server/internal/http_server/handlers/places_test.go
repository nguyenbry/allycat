package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/nguyen/allycat/internal/places"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func ptr[T any](v T) *T { return &v }

// decodeBody pulls the shared {message, data} envelope out of a response.
func decodeBody(t *testing.T, rec *httptest.ResponseRecorder) (message string, data json.RawMessage) {
	t.Helper()

	var body struct {
		Message *string         `json:"message"`
		Data    json.RawMessage `json:"data"`
	}

	require.NoError(t, json.NewDecoder(rec.Body).Decode(&body))

	if body.Message != nil {
		message = *body.Message
	}

	return message, body.Data
}

// handlerWith builds a handler whose Google calls are served by fn.
func handlerWith(t *testing.T, fn http.HandlerFunc) (PlacesHandler, func()) {
	t.Helper()

	ts := httptest.NewServer(fn)

	api, err := places.NewPlacesApi(
		"test-key",
		places.WithSearchTextURL(ts.URL),
		places.WithComputeRoutesURL(ts.URL),
		places.WithHTTPClient(ts.Client()),
	)
	require.NoError(t, err)

	return NewPlacesHandler(api), ts.Close
}

// --- responder ------------------------------------------------------------

func TestWriteJSONResponseSetsContentTypeAndStatus(t *testing.T) {
	t.Parallel()

	rec := httptest.NewRecorder()

	WriteJSONResponse(rec, NewResponse().WithMessage("hi"), http.StatusTeapot)

	assert.Equal(t, http.StatusTeapot, rec.Code)
	assert.Equal(t, "application/json", rec.Header().Get("Content-Type"))

	msg, data := decodeBody(t, rec)
	assert.Equal(t, "hi", msg)
	assert.JSONEq(t, "null", string(data))
}

func TestResponseBuildersAreImmutable(t *testing.T) {
	t.Parallel()

	base := NewResponse()
	withMsg := base.WithMessage("m")
	withData := base.WithData([]int{1})

	assert.Nil(t, base.Message, "builder must not mutate the receiver")
	assert.Nil(t, base.Data)
	assert.NotNil(t, withMsg.Message)
	assert.NotNil(t, withData.Data)
}

func TestWriteJSONResponseEncodesData(t *testing.T) {
	t.Parallel()

	rec := httptest.NewRecorder()

	WriteJSONResponse(rec, NewResponse().WithData([]string{"a"}), http.StatusOK)

	msg, data := decodeBody(t, rec)
	assert.Empty(t, msg)
	assert.JSONEq(t, `["a"]`, string(data))
}

// --- payload validation ---------------------------------------------------

func TestOptimizeRoutePayloadPlaceValidate(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		place   optimizeRoutePayloadPlace
		wantErr string
	}{
		{
			name:  "valid",
			place: optimizeRoutePayloadPlace{Id: "x", Lat: ptr(1.0), Long: ptr(2.0)},
		},
		{
			name:    "missing id",
			place:   optimizeRoutePayloadPlace{Lat: ptr(1.0), Long: ptr(2.0)},
			wantErr: "'id' is required",
		},
		{
			name:    "missing latitude",
			place:   optimizeRoutePayloadPlace{Id: "x", Long: ptr(2.0)},
			wantErr: "'latitude' is required",
		},
		{
			name:    "missing longitude",
			place:   optimizeRoutePayloadPlace{Id: "x", Lat: ptr(1.0)},
			wantErr: "'longitude' is required",
		},
		{
			// Pointers exist precisely so the equator and prime meridian are
			// not mistaken for absent values.
			name:  "zero coordinates are valid",
			place: optimizeRoutePayloadPlace{Id: "x", Lat: ptr(0.0), Long: ptr(0.0)},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			err := tt.place.validate()

			if tt.wantErr == "" {
				assert.NoError(t, err)
				return
			}

			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.wantErr)
		})
	}
}

// --- HandleTextSearch -----------------------------------------------------

func TestHandleTextSearchRejectsShortQuery(t *testing.T) {
	t.Parallel()

	called := false
	h, closeFn := handlerWith(t, func(w http.ResponseWriter, _ *http.Request) {
		called = true
		_, _ = w.Write([]byte(`{"places":[]}`))
	})
	defer closeFn()

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/search", strings.NewReader(`{"query":"abc"}`))

	h.HandleTextSearch(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.False(t, called, "Google must not be billed for a query that cannot succeed")

	msg, _ := decodeBody(t, rec)
	assert.Contains(t, msg, "at least 4 characters")
}

func TestHandleTextSearchRejectsInvalidJSON(t *testing.T) {
	t.Parallel()

	h, closeFn := handlerWith(t, func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"places":[]}`))
	})
	defer closeFn()

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/search", strings.NewReader(`{`))

	h.HandleTextSearch(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestHandleTextSearchReturnsPlaces(t *testing.T) {
	t.Parallel()

	h, closeFn := handlerWith(t, func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"places":[{
			"id":"p1",
			"formattedAddress":"addr",
			"displayName":{"text":"name"},
			"googleMapsLinks":{"directionsUri":"uri"},
			"location":{"latitude":1,"longitude":2}
		}]}`))
	})
	defer closeFn()

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/search", strings.NewReader(`{"query":"city hall"}`))

	h.HandleTextSearch(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	_, data := decodeBody(t, rec)

	var got []struct {
		Id       string `json:"id"`
		Location struct {
			Lat  float64 `json:"latitude"`
			Long float64 `json:"longitude"`
		} `json:"location"`
	}
	require.NoError(t, json.Unmarshal(data, &got))

	require.Len(t, got, 1)
	assert.Equal(t, "p1", got[0].Id)
	assert.Equal(t, 1.0, got[0].Location.Lat)
	assert.Equal(t, 2.0, got[0].Location.Long)
}

func TestHandleTextSearchForwardsLocationBias(t *testing.T) {
	t.Parallel()

	var seen map[string]any

	h, closeFn := handlerWith(t, func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(raw, &seen)
		_, _ = w.Write([]byte(`{"places":[]}`))
	})
	defer closeFn()

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/search",
		strings.NewReader(`{"query":"city hall","locationBias":{"latitude":39.95,"longitude":-75.16}}`))

	h.HandleTextSearch(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, seen, "locationBias", "base location must reach Google")
}

func TestHandleTextSearchReportsUpstreamFailure(t *testing.T) {
	t.Parallel()

	h, closeFn := handlerWith(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":{"message":"API key expired. Please renew the API key.","status":"INVALID_ARGUMENT"}}`))
	})
	defer closeFn()

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/search", strings.NewReader(`{"query":"city hall"}`))

	h.HandleTextSearch(rec, req)

	assert.Equal(t, http.StatusInternalServerError, rec.Code)

	msg, _ := decodeBody(t, rec)
	assert.Contains(t, msg, "API key expired")
}

// --- HandleOptimizeRoute --------------------------------------------------

const validOptimizeBody = `{
	"origin":{"id":"start","latitude":39.95,"longitude":-75.18},
	"stops":[
		{"id":"a","latitude":39.96,"longitude":-75.19},
		{"id":"b","latitude":39.97,"longitude":-75.20}
	],
	"destination":{"id":"end","latitude":39.94,"longitude":-75.17}
}`

func TestHandleOptimizeRouteRejectsInvalidJSON(t *testing.T) {
	t.Parallel()

	h, closeFn := handlerWith(t, func(w http.ResponseWriter, _ *http.Request) {})
	defer closeFn()

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/optimize", strings.NewReader(`{`))

	h.HandleOptimizeRoute(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)

	msg, _ := decodeBody(t, rec)
	assert.Equal(t, "Invalid payload", msg)
}

func TestHandleOptimizeRouteValidation(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		body    string
		wantMsg string
	}{
		{
			name:    "origin missing id",
			body:    `{"origin":{"latitude":1,"longitude":2},"stops":[{"id":"a","latitude":1,"longitude":2},{"id":"b","latitude":1,"longitude":2}]}`,
			wantMsg: "start 'id' is required",
		},
		{
			name:    "origin missing latitude",
			body:    `{"origin":{"id":"s","longitude":2},"stops":[{"id":"a","latitude":1,"longitude":2},{"id":"b","latitude":1,"longitude":2}]}`,
			wantMsg: "start 'latitude' is required",
		},
		{
			name:    "destination missing longitude",
			body:    `{"origin":{"id":"s","latitude":1,"longitude":2},"destination":{"id":"e","latitude":1},"stops":[{"id":"a","latitude":1,"longitude":2},{"id":"b","latitude":1,"longitude":2}]}`,
			wantMsg: "end 'longitude' is required",
		},
		{
			name:    "stop missing id reports its index",
			body:    `{"origin":{"id":"s","latitude":1,"longitude":2},"stops":[{"id":"a","latitude":1,"longitude":2},{"latitude":1,"longitude":2}]}`,
			wantMsg: "stop at index 1 'id' is required",
		},
		{
			name:    "too few stops",
			body:    `{"origin":{"id":"s","latitude":1,"longitude":2},"stops":[{"id":"a","latitude":1,"longitude":2}]}`,
			wantMsg: "At least two stops are required",
		},
		{
			name:    "no stops",
			body:    `{"origin":{"id":"s","latitude":1,"longitude":2},"stops":[]}`,
			wantMsg: "At least two stops are required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			h, closeFn := handlerWith(t, func(w http.ResponseWriter, _ *http.Request) {
				t.Error("upstream must not be called for an invalid payload")
			})
			defer closeFn()

			rec := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, "/optimize", strings.NewReader(tt.body))

			h.HandleOptimizeRoute(rec, req)

			assert.Equal(t, http.StatusBadRequest, rec.Code)

			msg, _ := decodeBody(t, rec)
			assert.Equal(t, tt.wantMsg, msg)
		})
	}
}

func TestHandleOptimizeRouteReturnsSolverResultEvenWhenGoogleFails(t *testing.T) {
	t.Parallel()

	// The local solver is the fallback that keeps the app usable mid-race when
	// Google is unreachable, over quota, or slow.
	h, closeFn := handlerWith(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":{"message":"nope"}}`))
	})
	defer closeFn()

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/optimize", strings.NewReader(validOptimizeBody))

	h.HandleOptimizeRoute(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	_, data := decodeBody(t, rec)

	var got []struct {
		Method string `json:"method"`
		End    string `json:"destination"`
		Bike   *struct {
			Order  []string `json:"order"`
			Meters int64    `json:"meters"`
		} `json:"bike"`
		Car *struct{} `json:"car"`
	}
	require.NoError(t, json.Unmarshal(data, &got))

	require.Len(t, got, 1, "only the solver result should survive an upstream failure")
	assert.Equal(t, "tsp", got[0].Method)
	assert.Equal(t, "end", got[0].End)

	require.NotNil(t, got[0].Bike)
	assert.ElementsMatch(t, []string{"a", "b"}, got[0].Bike.Order)
	assert.Positive(t, got[0].Bike.Meters)
	assert.Nil(t, got[0].Car, "the solver models bikes only")
}

func TestHandleOptimizeRouteIncludesGoogleRoutesOnSuccess(t *testing.T) {
	t.Parallel()

	h, closeFn := handlerWith(t, func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)

		var body struct {
			Intermediates []struct {
				Id string `json:"placeId"`
			} `json:"intermediates"`
		}
		_ = json.Unmarshal(raw, &body)

		idx := make([]int, len(body.Intermediates))
		for i := range idx {
			idx[i] = i
		}

		_ = json.NewEncoder(w).Encode(map[string]any{
			"routes": []map[string]any{{
				"distanceMeters":                    4242,
				"optimizedIntermediateWaypointIndex": idx,
				"localizedValues": map[string]any{
					"distance": map[string]any{"text": "2.6 mi"},
					"duration": map[string]any{"text": "15 mins"},
				},
			}},
		})
	})
	defer closeFn()

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/optimize", strings.NewReader(validOptimizeBody))

	h.HandleOptimizeRoute(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	_, data := decodeBody(t, rec)

	var got []struct {
		Method string `json:"method"`
		End    string `json:"destination"`
	}
	require.NoError(t, json.Unmarshal(data, &got))

	require.Len(t, got, 2, "solver result plus the Google result")

	methods := []string{got[0].Method, got[1].Method}
	assert.Contains(t, methods, "tsp")
	assert.Contains(t, methods, "", "the Google result carries no method tag")
}

func TestHandleOptimizeRouteWorksWithoutDestination(t *testing.T) {
	t.Parallel()

	h, closeFn := handlerWith(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})
	defer closeFn()

	body := `{
		"origin":{"id":"start","latitude":39.95,"longitude":-75.18},
		"stops":[
			{"id":"a","latitude":39.96,"longitude":-75.19},
			{"id":"b","latitude":39.97,"longitude":-75.20},
			{"id":"c","latitude":39.98,"longitude":-75.21}
		]
	}`

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/optimize", strings.NewReader(body))

	h.HandleOptimizeRoute(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	_, data := decodeBody(t, rec)

	var got []struct {
		Method string `json:"method"`
		End    string `json:"destination"`
		Bike   *struct {
			Order []string `json:"order"`
		} `json:"bike"`
	}
	require.NoError(t, json.Unmarshal(data, &got))

	require.Len(t, got, 1)
	assert.Equal(t, "tsp", got[0].Method)

	// With no fixed finish the solver picks one of the stops, and the
	// remaining stops make up the order.
	assert.Contains(t, []string{"a", "b", "c"}, got[0].End)
	require.NotNil(t, got[0].Bike)
	assert.Len(t, got[0].Bike.Order, 2)
	assert.NotContains(t, got[0].Bike.Order, got[0].End)
}

// --- HandleRouteLegs ------------------------------------------------------

func legsUpstream(meters []int64) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		legs := make([]map[string]any, 0, len(meters))
		var total int64

		for _, m := range meters {
			total += m
			legs = append(legs, map[string]any{
				"distanceMeters": m,
				"localizedValues": map[string]any{
					"distance": map[string]any{"text": "1.0 mi"},
					"duration": map[string]any{"text": "5 mins"},
				},
			})
		}

		_ = json.NewEncoder(w).Encode(map[string]any{
			"routes": []map[string]any{{
				"distanceMeters": total,
				"localizedValues": map[string]any{
					"distance": map[string]any{"text": "3.0 mi"},
					"duration": map[string]any{"text": "15 mins"},
				},
				"legs": legs,
			}},
		})
	}
}

func TestHandleRouteLegsReturnsPerHopDistances(t *testing.T) {
	t.Parallel()

	h, closeFn := handlerWith(t, legsUpstream([]int64{100, 200, 300}))
	defer closeFn()

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/legs", strings.NewReader(
		`{"origin":"start","stops":["a","b"],"destination":"end"}`))

	h.HandleRouteLegs(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	_, data := decodeBody(t, rec)

	var got struct {
		Legs []struct {
			FromId string `json:"fromId"`
			ToId   string `json:"toId"`
			Meters int64  `json:"meters"`
		} `json:"legs"`
		Meters int64 `json:"meters"`
	}
	require.NoError(t, json.Unmarshal(data, &got))

	require.Len(t, got.Legs, 3)
	assert.Equal(t, "start", got.Legs[0].FromId)
	assert.Equal(t, "a", got.Legs[0].ToId)
	assert.Equal(t, "b", got.Legs[2].FromId)
	assert.Equal(t, "end", got.Legs[2].ToId)
	assert.Equal(t, int64(600), got.Meters)
}

func TestHandleRouteLegsRejectsInvalidJSON(t *testing.T) {
	t.Parallel()

	h, closeFn := handlerWith(t, legsUpstream([]int64{1}))
	defer closeFn()

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/legs", strings.NewReader(`{`))

	h.HandleRouteLegs(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)

	msg, _ := decodeBody(t, rec)
	assert.Equal(t, "Invalid payload", msg)
}

func TestHandleRouteLegsRejectsMissingWaypoints(t *testing.T) {
	t.Parallel()

	called := false
	h, closeFn := handlerWith(t, func(w http.ResponseWriter, r *http.Request) {
		called = true
		legsUpstream([]int64{1})(w, r)
	})
	defer closeFn()

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/legs", strings.NewReader(
		`{"stops":["a"],"destination":"end"}`))

	h.HandleRouteLegs(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.False(t, called, "an incomplete route must not be billed upstream")

	msg, _ := decodeBody(t, rec)
	assert.Contains(t, msg, "origin is required")
}

func TestHandleRouteLegsReportsUpstreamFailure(t *testing.T) {
	t.Parallel()

	h, closeFn := handlerWith(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte(`{"error":{"message":"Routes API has not been used"}}`))
	})
	defer closeFn()

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/legs", strings.NewReader(
		`{"origin":"start","stops":["a"],"destination":"end"}`))

	h.HandleRouteLegs(rec, req)

	// The client treats any failure the same way: skip the enrichment and keep
	// showing the route the rider already has.
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	msg, _ := decodeBody(t, rec)
	assert.Contains(t, msg, "Routes API has not been used")
}
