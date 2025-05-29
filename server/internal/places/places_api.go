package places

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
)

type textSearchRequestBody struct {
	Query string `json:"textQuery"`
}

type textSearchFieldMask struct {
	id               bool
	formattedAddress bool
}

func newTextSearchFieldMask() textSearchFieldMask {
	return textSearchFieldMask{}
}

func (t textSearchFieldMask) setId(b bool) textSearchFieldMask {
	t.id = b
	return t
}

func (t textSearchFieldMask) setFormattedAddress(b bool) textSearchFieldMask {
	t.formattedAddress = b
	return t
}

func (t textSearchFieldMask) string() *string {
	var masks []string

	if t.id {
		masks = append(masks, "places.id")
	}

	if t.formattedAddress {
		masks = append(masks, "places.formattedAddress")
	}

	if len(masks) == 0 {
		return nil
	}

	out := strings.Join(masks, ",")
	return &out
}

type PlacesApi struct {
	apiKey string
	client *http.Client
}

func NewPlacesApi(apiKey string) (*PlacesApi, error) {
	if apiKey == "" {
		return nil, errors.New("api key is required for Google Maps")
	}

	return &PlacesApi{
		apiKey: apiKey,
		client: &http.Client{},
	}, nil
}

func (p *PlacesApi) buildRequest(method string, url string, body io.Reader) (*http.Request, error) {
	r, err := http.NewRequest(method, url, body)

	if err != nil {
		return nil, fmt.Errorf("error creating request: %w", err)
	}

	// common headers we'll probably need as the API evolves
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("X-Goog-Api-Key", p.apiKey)

	return r, nil
}

func (p *PlacesApi) TextSearch(query string) ([]byte, error) {
	body := textSearchRequestBody{
		Query: query,
	}

	jsonData, err := json.Marshal(body)

	if err != nil {
		return nil, err
	}

	req, err := p.buildRequest("POST", "https://places.googleapis.com/v1/places:searchText", bytes.NewBuffer(jsonData))

	if err != nil {
		return nil, err
	}

	fieldMask := newTextSearchFieldMask().setId(true).
		setFormattedAddress(true).string()

	if fieldMask == nil {
		req.Header.Set("X-Goog-FieldMask", "*")
	} else {
		req.Header.Set("X-Goog-FieldMask", "*")
		// req.Header.Set("X-Goog-FieldMask", *fieldMask)
	}

	resp, err := p.client.Do(req)

	if err != nil {
		return nil, err
	}

	defer drainAndClose(resp.Body)

	fmt.Println("Response Status:", resp.Status)

	respBody, err := io.ReadAll(resp.Body)

	if err != nil {
		return nil, fmt.Errorf("error reading response: %w", err)
	}

	// Check for HTTP errors
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(respBody))
	} else {
		return respBody, nil
	}
}

// https://www.reddit.com/r/golang/comments/fil647/this_3_year_old_thread_had_an_important_dicussion/
func drainAndClose(rc io.ReadCloser) {
	io.Copy(io.Discard, rc)
	rc.Close()
}
