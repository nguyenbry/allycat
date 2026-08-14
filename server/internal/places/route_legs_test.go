package places

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// legsResponse builds a computeRoutes reply carrying n legs.
func legsResponse(meters []int64) string {
	legs := make([]map[string]any, 0, len(meters))
	var total int64

	for _, m := range meters {
		total += m
		legs = append(legs, map[string]any{
			"distanceMeters": m,
			"localizedValues": map[string]any{
				"distance": map[string]any{"text": "x mi"},
				"duration": map[string]any{"text": "y mins"},
			},
		})
	}

	body, _ := json.Marshal(map[string]any{
		"routes": []map[string]any{{
			"distanceMeters": total,
			"localizedValues": map[string]any{
				"distance": map[string]any{"text": "total mi"},
				"duration": map[string]any{"text": "total mins"},
			},
			"legs": legs,
		}},
	})

	return string(body)
}

func TestRouteLegsPairsLegsToWaypointsInOrder(t *testing.T) {
	t.Parallel()

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(legsResponse([]int64{100, 200, 300})))
	}))
	defer ts.Close()

	api := newTestApi(t, ts)

	got, err := api.RouteLegs(context.Background(), RouteLegsOptions{
		Origin:      "start",
		Stops:       []string{"a", "b"},
		Destination: "end",
	})
	require.NoError(t, err)

	// start -> a -> b -> end is three hops, in that order.
	require.Len(t, got.Legs, 3)

	assert.Equal(t, "start", got.Legs[0].FromId)
	assert.Equal(t, "a", got.Legs[0].ToId)
	assert.Equal(t, int64(100), got.Legs[0].Meters)

	assert.Equal(t, "a", got.Legs[1].FromId)
	assert.Equal(t, "b", got.Legs[1].ToId)
	assert.Equal(t, int64(200), got.Legs[1].Meters)

	assert.Equal(t, "b", got.Legs[2].FromId)
	assert.Equal(t, "end", got.Legs[2].ToId)
	assert.Equal(t, int64(300), got.Legs[2].Meters)

	assert.Equal(t, int64(600), got.Meters)
	assert.Equal(t, "total mi", got.DisplayDistance)
	assert.Equal(t, "total mins", got.DisplayDuration)
}

func TestRouteLegsDoesNotAskGoogleToReorder(t *testing.T) {
	t.Parallel()

	var body map[string]any

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(raw, &body)
		_, _ = w.Write([]byte(legsResponse([]int64{1, 2, 3})))
	}))
	defer ts.Close()

	api := newTestApi(t, ts)

	_, err := api.RouteLegs(context.Background(), RouteLegsOptions{
		Origin:      "start",
		Stops:       []string{"a", "b"},
		Destination: "end",
	})
	require.NoError(t, err)

	// The whole point is measuring the order we were given.
	assert.Equal(t, false, body["optimizeWaypointOrder"])

	intermediates, ok := body["intermediates"].([]any)
	require.True(t, ok)
	require.Len(t, intermediates, 2)

	first, _ := intermediates[0].(map[string]any)
	second, _ := intermediates[1].(map[string]any)
	assert.Equal(t, "a", first["placeId"])
	assert.Equal(t, "b", second["placeId"])
}

func TestRouteLegsRequestsLegFields(t *testing.T) {
	t.Parallel()

	var mask string

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mask = r.Header.Get("X-Goog-FieldMask")
		_, _ = w.Write([]byte(legsResponse([]int64{1, 2, 3})))
	}))
	defer ts.Close()

	api := newTestApi(t, ts)

	_, err := api.RouteLegs(context.Background(), RouteLegsOptions{
		Origin:      "start",
		Stops:       []string{"a", "b"},
		Destination: "end",
	})
	require.NoError(t, err)

	// Google returns nothing that is not named in the mask.
	assert.Contains(t, mask, "routes.legs.distanceMeters")
	assert.Contains(t, mask, "routes.legs.localizedValues")
}

func TestRouteLegsBikeAndCarModifiers(t *testing.T) {
	t.Parallel()

	capture := func(byCar bool) map[string]any {
		var body map[string]any

		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			raw, _ := io.ReadAll(r.Body)
			_ = json.Unmarshal(raw, &body)
			_, _ = w.Write([]byte(legsResponse([]int64{1, 2})))
		}))
		defer ts.Close()

		api := newTestApi(t, ts)

		_, err := api.RouteLegs(context.Background(), RouteLegsOptions{
			Origin:      "start",
			Stops:       []string{"a"},
			Destination: "end",
			ByCar:       byCar,
		})
		require.NoError(t, err)

		return body
	}

	bike := capture(false)
	assert.Equal(t, "BICYCLE", bike["travelMode"])
	_, hasModifiers := bike["routeModifiers"]
	assert.False(t, hasModifiers, "bikes are not affected by tolls or highways")

	car := capture(true)
	assert.Equal(t, "DRIVE", car["travelMode"])
	assert.Contains(t, car, "routeModifiers")
}

func TestRouteLegsRejectsLegCountMismatch(t *testing.T) {
	t.Parallel()

	// Two legs cannot describe a three-hop route; pairing ids to them would be
	// a guess, and a wrong "distance to next stop" mid-race is worse than none.
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(legsResponse([]int64{100, 200})))
	}))
	defer ts.Close()

	api := newTestApi(t, ts)

	_, err := api.RouteLegs(context.Background(), RouteLegsOptions{
		Origin:      "start",
		Stops:       []string{"a", "b"},
		Destination: "end",
	})

	require.Error(t, err)
	assert.Contains(t, err.Error(), "expected 3 legs")
}

func TestRouteLegsErrorsWhenNoRouteReturned(t *testing.T) {
	t.Parallel()

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"routes":[]}`))
	}))
	defer ts.Close()

	api := newTestApi(t, ts)

	_, err := api.RouteLegs(context.Background(), RouteLegsOptions{
		Origin:      "start",
		Stops:       []string{"a"},
		Destination: "end",
	})

	require.Error(t, err)
	assert.Contains(t, err.Error(), "no route returned")
}

func TestRouteLegsSurfacesGoogleErrorMessage(t *testing.T) {
	t.Parallel()

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte(`{"error":{"message":"Routes API has not been used","status":"PERMISSION_DENIED"}}`))
	}))
	defer ts.Close()

	api := newTestApi(t, ts)

	_, err := api.RouteLegs(context.Background(), RouteLegsOptions{
		Origin:      "start",
		Stops:       []string{"a"},
		Destination: "end",
	})

	require.Error(t, err)
	assert.Contains(t, err.Error(), "403")
	assert.Contains(t, err.Error(), "Routes API has not been used")
}

func TestRouteLegsValidation(t *testing.T) {
	t.Parallel()

	api, err := NewPlacesApi("k")
	require.NoError(t, err)

	tests := []struct {
		name    string
		opts    RouteLegsOptions
		wantErr string
	}{
		{
			name:    "missing origin",
			opts:    RouteLegsOptions{Destination: "end"},
			wantErr: "origin is required",
		},
		{
			name:    "missing destination",
			opts:    RouteLegsOptions{Origin: "start"},
			wantErr: "destination is required",
		},
		{
			name:    "blank stop reports its index",
			opts:    RouteLegsOptions{Origin: "start", Destination: "end", Stops: []string{"a", ""}},
			wantErr: "stop at index 1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			_, err := api.RouteLegs(context.Background(), tt.opts)

			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.wantErr)
		})
	}
}

func TestRouteLegsSupportsNoIntermediates(t *testing.T) {
	t.Parallel()

	var body map[string]any

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(raw, &body)
		_, _ = w.Write([]byte(legsResponse([]int64{500})))
	}))
	defer ts.Close()

	api := newTestApi(t, ts)

	got, err := api.RouteLegs(context.Background(), RouteLegsOptions{
		Origin:      "start",
		Destination: "end",
	})
	require.NoError(t, err)

	require.Len(t, got.Legs, 1)
	assert.Equal(t, "start", got.Legs[0].FromId)
	assert.Equal(t, "end", got.Legs[0].ToId)

	// omitempty: an empty intermediates array is not sent at all.
	_, hasIntermediates := body["intermediates"]
	assert.False(t, hasIntermediates)
}
