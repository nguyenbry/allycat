package places

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"sync"

	"golang.org/x/sync/errgroup"
)

type PlacesApi struct {
	apiKey  string
	httpCli *http.Client
}

type longLat struct {
	Long float64 `json:"longitude"`
	Lat  float64 `json:"latitude"`
}

type TextSearchOptions struct {
	Query   string   `json:"query"`
	LongLat *longLat `json:"locationBias,omitempty"`
}

func NewPlacesApi(apiKey string) (*PlacesApi, error) {
	if apiKey == "" {
		return nil, errors.New("api key is required for Google Maps")
	}

	return &PlacesApi{
		apiKey:  apiKey,
		httpCli: &http.Client{},
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

func (p *PlacesApi) TextSearch(opts TextSearchOptions) ([]place, error) {

	fmt.Println(100)
	type locationBias struct {
		Circle struct {
			Center struct {
				Lat  float64 `json:"latitude"`
				Long float64 `json:"longitude"`
			} `json:"center"`
			Radius float64 `json:"radius"`
		} `json:"circle"`
	}

	fmt.Println(102)

	getLocationBias := func(long float64, lat float64) *locationBias {
		out := locationBias{}
		out.Circle.Radius = 25000
		out.Circle.Center.Lat = lat
		out.Circle.Center.Long = long

		return &out
	}

	fmt.Println(103)

	var body struct {
		Query        string        `json:"textQuery"`
		LocationBias *locationBias `json:"locationBias,omitempty"`
	}

	body.Query = opts.Query

	if opts.LongLat != nil {
		body.LocationBias = getLocationBias(opts.LongLat.Long, opts.LongLat.Lat)
	}

	jsonData, err := json.Marshal(body)

	fmt.Println("Request body:", string(jsonData))

	if err != nil {
		return nil, err
	}

	req, err := p.buildRequest("POST", "https://places.googleapis.com/v1/places:searchText", bytes.NewBuffer(jsonData))

	if err != nil {
		return nil, err
	}

	masks := []string{
		"places.id",
		"places.formattedAddress",
		"places.googleMapsUri",
		"places.location",
		"places.displayName.text",
		"places.googleMapsLinks.directionsUri",
	}

	req.Header.Set("X-Goog-FieldMask", strings.Join(masks, ","))

	resp, err := p.httpCli.Do(req)

	if err != nil {
		return nil, err
	} else {
		defer drainAndClose(resp.Body)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API request failed with status %d", resp.StatusCode)
	}

	respBody, err := io.ReadAll(resp.Body)

	if err != nil {
		return nil, fmt.Errorf("error reading response: %w", err)
	} else {
		fmt.Println(105, string(respBody))
	}

	// Check for HTTP errors

	var respData struct {
		Places []place `json:"places"`
	}

	err = json.Unmarshal(respBody, &respData)
	if err != nil {
		return nil, fmt.Errorf("error unmarshalling response: %w", err)
	}

	if len(respData.Places) == 0 {
		return make([]place, 0), nil
	}

	return respData.Places, nil
}

type optimizeRouteOptions struct {
	start string
	stops []string
	end   *string
}

func NewOptimizeRoutePayloadBuilder() optimizeRouteOptions {
	return optimizeRouteOptions{}
}

func (b optimizeRouteOptions) WithStart(start string) optimizeRouteOptions {
	b.start = start
	return b
}

func (b optimizeRouteOptions) WithStops(stops []string) optimizeRouteOptions {
	b.stops = stops
	return b
}

func (b optimizeRouteOptions) WithEnd(end *string) optimizeRouteOptions {
	b.end = end
	return b
}

type optimizePayloadPlace struct {
	Id string `json:"placeId"`
}

type optimizePayloadAvoids struct {
	Tolls    bool `json:"avoidTolls"`
	Highways bool `json:"avoidHighways"`
}

type optimizePayload struct {
	Optimize string                 `json:"optimizeWaypointOrder"`
	Start    optimizePayloadPlace   `json:"origin"`
	End      optimizePayloadPlace   `json:"destination"`
	Stops    []optimizePayloadPlace `json:"intermediates"`
	Avoids   *optimizePayloadAvoids `json:"routeModifiers,omitempty"`
	Vehicle  string                 `json:"travelMode,omitempty"`
}

func optimizePayloadFromOptions(opts optimizeRouteOptions) ([]optimizePayload, error) {
	if opts.end == nil {
		// we need to set a couple ends and try them all out

		out := make([]optimizePayload, 0, len(opts.stops))

		for i, tryEnd := range opts.stops {
			p := optimizePayload{
				Optimize: "true",
				Start: optimizePayloadPlace{
					Id: opts.start,
				},
				End: optimizePayloadPlace{
					Id: tryEnd,
				},
				Stops: func() []optimizePayloadPlace {
					out := make([]optimizePayloadPlace, 0, len(opts.stops)-1)

					for _, stop := range opts.stops[:i] {
						out = append(out, optimizePayloadPlace{
							Id: stop,
						})
					}

					for _, stop := range opts.stops[i+1:] {
						out = append(out, optimizePayloadPlace{
							Id: stop,
						})
					}

					return out
				}(),
			}

			out = append(out, p)
		}

		return out, nil

	} else {
		end := *opts.end

		if end == "" {
			return nil, errors.New("end cannot be empty if provided")
		}

		return []optimizePayload{{
			Optimize: "true",
			Start: optimizePayloadPlace{
				Id: opts.start,
			},
			End: optimizePayloadPlace{
				Id: end,
			},
			Stops: func() []optimizePayloadPlace {
				out := make([]optimizePayloadPlace, len(opts.stops))

				for i, stop := range opts.stops {
					out[i] = optimizePayloadPlace{
						Id: stop,
					}
				}
				return out
			}(),
		}}, nil
	}
}

func (p optimizePayload) asCar() optimizePayload {
	a := &optimizePayloadAvoids{
		Tolls:    true,
		Highways: true,
	}
	p.Avoids = a
	p.Vehicle = "DRIVE"
	return p
}

func (p optimizePayload) asBike() optimizePayload {
	p.Avoids = nil
	p.Vehicle = "BICYCLE"
	return p
}

type Out struct {
	End       string                 `json:"destination"`
	BikeRoute *optimizeRouteResponse `json:"bike,omitempty"`
	CarRoute  *optimizeRouteResponse `json:"car,omitempty"`
}

func (p *PlacesApi) OptimizeRoute(opts optimizeRouteOptions) ([]Out, error) {
	// a valid route is made of a start, at least two stops,
	// and an optional end
	if opts.start == "" {
		return nil, errors.New("start location is required")
	} else if len(opts.stops) < 2 {
		return nil, errors.New("at least two stops are required")
	} else if opts.end != nil && *opts.end == "" {
		return nil, errors.New("end location cannot be empty if provided")
	}

	fmt.Printf("Optimizing with: %+v\n", opts)

	nakedBodies, err := optimizePayloadFromOptions(opts)

	if err != nil {
		return nil, err
	}

	bikeBodies := make([]optimizePayload, 0, len(nakedBodies))
	carBodies := make([]optimizePayload, 0, len(nakedBodies))

	for _, nakedBody := range nakedBodies {
		bikeBody := nakedBody.asBike()
		bikeBodies = append(bikeBodies, bikeBody)

		carBody := nakedBody.asCar()
		carBodies = append(carBodies, carBody)
	}

	fmt.Println("len100", len(bikeBodies), len(carBodies))

	var bikeMu sync.Mutex
	var bikeResponses []optimizeRouteResponse
	bikeEg, _ := errgroup.WithContext(context.Background())

	var carMu sync.Mutex
	var carResponses []optimizeRouteResponse
	carEg, _ := errgroup.WithContext(context.Background())

	doReq := func(body optimizePayload) ([]optimizeRouteResponse, error) {
		jsonData, err := json.Marshal(body)

		// fmt.Println("Request body:", string(jsonData))

		if err != nil {
			return nil, fmt.Errorf("marshaling body: %w", err)
		}

		req, err := p.buildRequest("POST", "https://routes.googleapis.com/directions/v2:computeRoutes", bytes.NewBuffer(jsonData))

		if err != nil {
			return nil, fmt.Errorf("building req: %w", err)
		}

		req.Header.Set("X-Goog-FieldMask", strings.Join([]string{
			// "routes.legs",
			"routes.distanceMeters",
			// "routes.duration",
			// "routes.staticDuration",
			"routes.optimizedIntermediateWaypointIndex",
			"routes.localizedValues",
		}, ","))

		resp, err := p.httpCli.Do(req)

		if err != nil {
			return nil, fmt.Errorf(".Do: %w", err)
		}

		if resp.StatusCode != http.StatusOK {
			return nil, (fmt.Errorf("API request failed with status %d", resp.StatusCode))
		}

		respBody, err := io.ReadAll(resp.Body)

		if err != nil {
			return nil, fmt.Errorf("error reading response: %w", err)
		}

		fmt.Println()
		fmt.Println("Response body:", string(respBody))
		fmt.Println("yay1")

		var respData struct {
			Routes []struct {
				Order   []int `json:"optimizedIntermediateWaypointIndex"`
				Meters  int64 `json:"distanceMeters"`
				Display struct {
					Distance struct {
						Text string `json:"text"`
					} `json:"distance"`
					Duration struct {
						Text string `json:"text"`
					} `json:"duration"`
				} `json:"localizedValues"`
			} `json:"routes"`
		}

		err = json.Unmarshal(respBody, &respData)

		if err != nil {
			fmt.Println("err 100")
			return nil, fmt.Errorf("error unmarshaling response: %w", err)
		} else {
			fmt.Println("yay4")
		}

		var routes []optimizeRouteResponse

		for _, route := range respData.Routes {
			// map route to ids

			order := make([]string, 0, len(body.Stops))

			for _, idx := range route.Order {
				if idx > len(body.Stops)-1 || idx < 0 {
					return nil, fmt.Errorf("array length %d, but API returned idx %d", len(body.Stops), idx)
				}
				order = append(order, body.Stops[idx].Id)
			}

			if len(order) != len(body.Stops) {
				return nil, fmt.Errorf("expected len %d but got %d", len(order), len(body.Stops)+1)
			}

			routes = append(routes, optimizeRouteResponse{
				Order:           order,
				Meters:          route.Meters,
				end:             body.End.Id,
				DisplayDistance: route.Display.Distance.Text,
				DisplayDuration: route.Display.Duration.Text,
			})
		}

		return routes, nil
	}

	for _, bikeBody := range bikeBodies {
		bikeEg.Go(func() error {
			res, err := doReq(bikeBody)

			fmt.Printf("case 100 %+v\n", res)

			if err != nil {
				return err
			}

			bikeMu.Lock()
			defer bikeMu.Unlock()

			bikeResponses = append(bikeResponses, res...)

			return nil
		})
	}

	for _, carBody := range carBodies {
		carEg.Go(func() error {
			res, err := doReq(carBody)

			fmt.Printf("case 101 %+v\n", res)

			if err != nil {
				return err
			}

			carMu.Lock()
			defer carMu.Unlock()

			carResponses = append(carResponses, res...)

			return nil
		})
	}

	if err := bikeEg.Wait(); err != nil {
		return nil, err
	}

	if err := carEg.Wait(); err != nil {
		return nil, err
	}

	bikeKeyByEnd := make(map[string][]optimizeRouteResponse)

	for _, x := range bikeResponses {
		key := x.end

		bikeKeyByEnd[key] = append(bikeKeyByEnd[key], x)
	}

	carKeyByEnd := make(map[string][]optimizeRouteResponse)

	for _, x := range carResponses {
		key := x.end

		carKeyByEnd[key] = append(carKeyByEnd[key], x)
	}

	shortestByEnd := make(map[string]Out)

	for endId, routes := range bikeKeyByEnd {
		// all routes ending at endId

		sort.Slice(routes, func(i, j int) bool {
			// sort asc
			return routes[i].Meters < routes[j].Meters
		})

		// get the shortest route going by bike that ends up at this destination
		shortest := routes[0]

		x := shortestByEnd[endId]
		x.BikeRoute = &shortest
		x.End = shortest.end
		shortestByEnd[endId] = x
	}

	for endId, routes := range carKeyByEnd {
		// all routes ending at endId

		sort.Slice(routes, func(i, j int) bool {
			// sort asc
			return routes[i].Meters < routes[j].Meters
		})

		shortest := routes[0]

		x := shortestByEnd[endId]
		x.CarRoute = &shortest
		x.End = shortest.end
		shortestByEnd[endId] = x
	}

	out := make([]Out, 0, len(shortestByEnd))
	for _, x := range shortestByEnd {
		out = append(out, x)
	}

	return out, nil
}

type optimizeRouteResponse struct {
	Order           []string `json:"order"`
	Meters          int64    `json:"meters"`
	DisplayDistance string   `json:"displayDistance"`
	DisplayDuration string   `json:"displayDuration"`

	end string
}

type place struct {
	Id               string          `json:"id"`
	FormattedAddress string          `json:"formattedAddress"`
	GoogleMapsUri    string          `json:"googleMapsUri"`
	DisplayName      displayName     `json:"displayName"`
	Links            googleMapsLinks `json:"googleMapsLinks"`
	Coordinates      coordinates     `json:"location"`
}

type coordinates struct {
	Lat  float64 `json:"latitude"`
	Long float64 `json:"longitude"`
}

type displayName struct {
	Name string `json:"text"`
}

type googleMapsLinks struct {
	Directions string `json:"directionsUri"`
}

// https://www.reddit.com/r/golang/comments/fil647/this_3_year_old_thread_had_an_important_dicussion/
func drainAndClose(rc io.ReadCloser) {
	io.Copy(io.Discard, rc)
	rc.Close()
}
