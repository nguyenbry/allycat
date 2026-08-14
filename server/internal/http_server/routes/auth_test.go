package routes

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/nguyen/allycat/internal/http_server/handlers"
	"github.com/nguyen/allycat/internal/places"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const testPassword = "correct-horse-battery"

// routerWithPassword wires the real routes behind the real auth middleware.
// Upstream Google calls go to a server that always fails, because no test here
// should depend on them.
func routerWithPassword(t *testing.T, plaintext string) http.Handler {
	t.Helper()

	pw, err := newPassword(plaintext)
	require.NoError(t, err)

	hash, err := pw.HashPassword()
	require.NoError(t, err)

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	t.Cleanup(upstream.Close)

	api, err := places.NewPlacesApi(
		"test-key",
		places.WithSearchTextURL(upstream.URL),
		places.WithComputeRoutesURL(upstream.URL),
		places.WithHTTPClient(upstream.Client()),
	)
	require.NoError(t, err)

	mux := chi.NewRouter()
	InitializePlacesRoutes(mux, handlers.Handlers{Places: handlers.NewPlacesHandler(api)}, hash)

	return mux
}

func assertForbidden(t *testing.T, rec *httptest.ResponseRecorder) {
	t.Helper()

	assert.Equal(t, http.StatusForbidden, rec.Code)

	var body struct {
		Message *string `json:"message"`
	}
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&body))
	require.NotNil(t, body.Message)
	assert.Equal(t, "Forbidden", *body.Message)
}

// --- password value object ------------------------------------------------

func TestNewPasswordRejectsShortInput(t *testing.T) {
	t.Parallel()

	for _, raw := range []string{"", "a", "1234567"} {
		_, err := newPassword(raw)
		assert.ErrorIs(t, err, ErrWeakPassword, "%q should be rejected", raw)
	}
}

func TestNewPasswordAcceptsEightCharacters(t *testing.T) {
	t.Parallel()

	pw, err := newPassword("12345678")
	require.NoError(t, err)
	assert.Equal(t, password("12345678"), pw)
}

func TestPasswordHashIsSaltedPerCall(t *testing.T) {
	t.Parallel()

	pw, err := newPassword(testPassword)
	require.NoError(t, err)

	first, err := pw.HashPassword()
	require.NoError(t, err)

	second, err := pw.HashPassword()
	require.NoError(t, err)

	assert.NotEqual(t, first, second, "argon2id must use a fresh salt each time")
	assert.True(t, strings.HasPrefix(first, "$argon2id$"))

	// Both must still verify.
	for _, h := range []string{first, second} {
		ok, err := pw.ComparePasswordAndHash(h)
		require.NoError(t, err)
		assert.True(t, ok)
	}
}

func TestComparePasswordAndHashRejectsWrongPassword(t *testing.T) {
	t.Parallel()

	right, err := newPassword(testPassword)
	require.NoError(t, err)

	hash, err := right.HashPassword()
	require.NoError(t, err)

	wrong, err := newPassword("not-the-password")
	require.NoError(t, err)

	ok, err := wrong.ComparePasswordAndHash(hash)
	require.NoError(t, err)
	assert.False(t, ok)
}

func TestComparePasswordAndHashErrorsOnMalformedHash(t *testing.T) {
	t.Parallel()

	pw, err := newPassword(testPassword)
	require.NoError(t, err)

	ok, err := pw.ComparePasswordAndHash("not-a-hash")

	require.Error(t, err)
	assert.ErrorIs(t, err, ErrCompareFailed)
	assert.False(t, ok)
}

// --- auth middleware ------------------------------------------------------

func TestAuthRejectsMissingHeader(t *testing.T) {
	t.Parallel()

	r := routerWithPassword(t, testPassword)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/places/search", strings.NewReader(`{"query":"city hall"}`))

	r.ServeHTTP(rec, req)

	assertForbidden(t, rec)
}

func TestAuthRejectsShortPassword(t *testing.T) {
	t.Parallel()

	r := routerWithPassword(t, testPassword)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/places/search", strings.NewReader(`{"query":"city hall"}`))
	req.Header.Set("x-app-password", "short")

	r.ServeHTTP(rec, req)

	assertForbidden(t, rec)
}

func TestAuthRejectsWrongPassword(t *testing.T) {
	t.Parallel()

	r := routerWithPassword(t, testPassword)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/places/search", strings.NewReader(`{"query":"city hall"}`))
	req.Header.Set("x-app-password", "wrong-but-long-enough")

	r.ServeHTTP(rec, req)

	assertForbidden(t, rec)
}

func TestAuthAcceptsCorrectPassword(t *testing.T) {
	t.Parallel()

	r := routerWithPassword(t, testPassword)

	// A deliberately too-short query: reaching the handler's own 400 proves
	// the middleware let the request through.
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/places/search", strings.NewReader(`{"query":"ab"}`))
	req.Header.Set("x-app-password", testPassword)

	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.NotEqual(t, http.StatusForbidden, rec.Code)
}

func TestAuthHeaderIsCaseInsensitive(t *testing.T) {
	t.Parallel()

	r := routerWithPassword(t, testPassword)

	// The frontend sends lowercase; Go canonicalises, but pin the behaviour.
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/places/search", strings.NewReader(`{"query":"ab"}`))
	req.Header.Set("X-App-Password", testPassword)

	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestAuthGuardsOptimizeRouteToo(t *testing.T) {
	t.Parallel()

	r := routerWithPassword(t, testPassword)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/places/optimize", strings.NewReader(`{}`))

	r.ServeHTTP(rec, req)

	assertForbidden(t, rec)
}

func TestAuthDoesNotLeakWhetherPasswordWasClose(t *testing.T) {
	t.Parallel()

	r := routerWithPassword(t, testPassword)

	// Every rejection must be indistinguishable to a caller.
	bodies := make([]string, 0, 2)

	for _, attempt := range []string{"wrong-but-long-enough", "correct-horse-batter"} {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/places/search", strings.NewReader(`{"query":"city hall"}`))
		req.Header.Set("x-app-password", attempt)

		r.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusForbidden, rec.Code)
		bodies = append(bodies, rec.Body.String())
	}

	assert.Equal(t, bodies[0], bodies[1])
}
