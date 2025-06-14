package places

import (
	"encoding/json"
	"log"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

var api *PlacesApi

func TestMain(m *testing.M) {
	// Setup
	key, ok := os.LookupEnv("MAPS_API_KEY")
	if !ok {
		log.Fatal("MAPS_API_KEY required to test")
	}

	var err error
	api, err = NewPlacesApi(key)
	if err != nil {
		log.Fatal(err)
	}

	// Run tests
	code := m.Run()

	// Cleanup (if needed)

	os.Exit(code)
}

func TestPlacesApiStructFields(t *testing.T) {
	t.Parallel()

	if api.apiKey == "" {
		t.Fatal("key should have been set")
	}

	if api.httpCli == nil {
		t.Fatal("http client not set up")
	}
}

func TestTextSearchOptionsJson(t *testing.T) {
	x := TextSearchOptions{
		Query:   "test",
		LongLat: nil,
	}

	val, err := json.Marshal(x)

	if err != nil {
		t.Fatal(err)
	}

	var parsed map[string]interface{}

	err = json.Unmarshal(val, &parsed)

	if err != nil {
		t.Fatal(err)
	}

	assert.NotNil(t, parsed)
	assert.Equal(t, 1, len(parsed))

	query := parsed["query"]

	assert.NotEmpty(t, query)
	assert.Equal(t, "test", query)

}
