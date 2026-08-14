package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/nguyen/allycat/internal/http_server/handlers"
	"github.com/nguyen/allycat/internal/places"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const allowedOrigin = "http://localhost:3000"

func testHandlers(t *testing.T) handlers.Handlers {
	t.Helper()

	api, err := places.NewPlacesApi("test-key")
	require.NoError(t, err)

	return handlers.Handlers{Places: handlers.NewPlacesHandler(api)}
}

func TestStartRequiresRegisteredRoutes(t *testing.T) {
	t.Parallel()

	s := NewServer()

	err := s.Start(":0", allowedOrigin)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "not initialized")
}

func TestHandlerRequiresRegisteredRoutes(t *testing.T) {
	t.Parallel()

	s := NewServer()

	h, err := s.Handler(allowedOrigin)

	require.Error(t, err)
	assert.Nil(t, h)
}

func TestHealthcheckIsUnauthenticated(t *testing.T) {
	t.Parallel()

	s := NewServer()
	s.RegisterRoutes(testHandlers(t), "irrelevant-hash")

	h, err := s.Handler(allowedOrigin)
	require.NoError(t, err)

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/status", nil))

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "ok", rec.Body.String())
}

func TestApiRoutesAreMountedUnderApi(t *testing.T) {
	t.Parallel()

	s := NewServer()
	s.RegisterRoutes(testHandlers(t), "irrelevant-hash")

	h, err := s.Handler(allowedOrigin)
	require.NoError(t, err)

	// Mounted and password-protected.
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/places/search", strings.NewReader(`{"query":"abcd"}`)))
	assert.Equal(t, http.StatusForbidden, rec.Code)

	// Not mounted at the bare path.
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/places/search", strings.NewReader(`{"query":"abcd"}`)))
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestCorsAllowsConfiguredOrigin(t *testing.T) {
	t.Parallel()

	s := NewServer()
	s.RegisterRoutes(testHandlers(t), "irrelevant-hash")

	h, err := s.Handler(allowedOrigin)
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodOptions, "/api/places/search", nil)
	req.Header.Set("Origin", allowedOrigin)
	req.Header.Set("Access-Control-Request-Method", http.MethodPost)
	req.Header.Set("Access-Control-Request-Headers", "x-app-password")

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	assert.Equal(t, allowedOrigin, rec.Header().Get("Access-Control-Allow-Origin"))

	// The frontend cannot authenticate if this header is not allowed.
	assert.Contains(t,
		strings.ToLower(rec.Header().Get("Access-Control-Allow-Headers")),
		"x-app-password",
	)
}

func TestCorsRejectsOtherOrigins(t *testing.T) {
	t.Parallel()

	s := NewServer()
	s.RegisterRoutes(testHandlers(t), "irrelevant-hash")

	h, err := s.Handler(allowedOrigin)
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodOptions, "/api/places/search", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	req.Header.Set("Access-Control-Request-Method", http.MethodPost)

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	assert.Empty(t, rec.Header().Get("Access-Control-Allow-Origin"),
		"an unlisted origin must not be echoed back as allowed")
}

func TestRegisterRoutesMarksServerInitialized(t *testing.T) {
	t.Parallel()

	s := NewServer()
	assert.False(t, s.initialized)

	s.RegisterRoutes(testHandlers(t), "irrelevant-hash")
	assert.True(t, s.initialized)
}
