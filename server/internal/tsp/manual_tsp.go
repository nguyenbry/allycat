package tsp

import (
	"math"
)

var (
	metersPerDegreeLat = 110540.0
)

func excludeAt[T any](slice []T, index int) []T {
	if index < 0 || index >= len(slice) {
		return slice // Return original if index is out of bounds
	}

	result := make([]T, 0, len(slice)-1)
	result = append(result, slice[:index]...)
	result = append(result, slice[index+1:]...)
	return result
}

type place struct {
	Id   string
	long float64
	lat  float64
}

// Calculate euclidean distance between two places
// this is flat earther logic btw
func (p place) euclideanDistanceTo(other place) float64 {
	dx := p.long - other.long
	dy := p.lat - other.lat
	return math.Sqrt(dx*dx + dy*dy)
}

// returns a copy of the place relative to the
// center of the bounding box
// the bounding box should be calculated and passed in
func (p place) asRelativeCoords(centerLat, centerLng float64) place {
	metersPerDegreeLng := 111320.0 * math.Cos(centerLat*math.Pi/180.0)

	x := (p.long - centerLng) * metersPerDegreeLng
	y := (p.lat - centerLat) * metersPerDegreeLat

	p.long = x
	p.lat = y

	return p
}

type tspRoute struct {
	start place
	end   *place
	stops []place
}

type optimalRoute struct {
	Stops  []place
	End    place
	Meters float64
}

// Exact TSP solver using dynamic programming (Held-Karp)
func solveTSPExact(dist [][]float64, start, end int) []int {
	n := len(dist)

	// Special case: only start and end
	if n == 2 {
		panic("todo")
	}

	// Create list of intermediate nodes (excluding start and end)
	intermediate := make([]int, 0, n-2)
	for i := 0; i < n; i++ {
		if i != start && i != end {
			intermediate = append(intermediate, i)
		}
	}

	if len(intermediate) == 0 {
		panic("todo")
	}

	// DP state: dp[mask][last] = minimum cost to visit nodes in mask, ending at last
	// mask represents which intermediate nodes have been visited
	numIntermediate := len(intermediate)
	dp := make([][]float64, 1<<numIntermediate)
	parent := make([][]int, 1<<numIntermediate)

	for i := range dp {
		dp[i] = make([]float64, numIntermediate)
		parent[i] = make([]int, numIntermediate)
		for j := range dp[i] {
			dp[i][j] = math.Inf(1)
			parent[i][j] = -1
		}
	}

	// Base case: start from 'start' node to each intermediate node
	for i := 0; i < numIntermediate; i++ {
		mask := 1 << i
		node := intermediate[i]
		dp[mask][i] = dist[start][node]
	}

	// Fill DP table
	for mask := 0; mask < (1 << numIntermediate); mask++ {
		for last := 0; last < numIntermediate; last++ {
			if (mask&(1<<last)) == 0 || dp[mask][last] == math.Inf(1) {
				continue
			}

			// Try extending to next unvisited node
			for next := 0; next < numIntermediate; next++ {
				if (mask & (1 << next)) != 0 {
					continue // already visited
				}

				newMask := mask | (1 << next)
				newCost := dp[mask][last] + dist[intermediate[last]][intermediate[next]]

				if newCost < dp[newMask][next] {
					dp[newMask][next] = newCost
					parent[newMask][next] = last
				}
			}
		}
	}

	// Find best way to reach end from any intermediate node
	allVisited := (1 << numIntermediate) - 1
	minCost := math.Inf(1)
	bestLast := -1

	for last := 0; last < numIntermediate; last++ {
		cost := dp[allVisited][last] + dist[intermediate[last]][end]
		if cost < minCost {
			minCost = cost
			bestLast = last
		}
	}

	// Reconstruct path
	if bestLast == -1 {
		// Fallback: direct path
		result := make([]int, n)
		for i := range result {
			result[i] = i
		}
		return result
	}

	// Backtrack to build path
	path := []int{}
	mask := allVisited
	curr := bestLast

	for mask != 0 {
		path = append(path, intermediate[curr])
		if parent[mask][curr] == -1 {
			break
		}
		newCurr := parent[mask][curr]
		mask ^= (1 << curr)
		curr = newCurr
	}

	// Reverse path and add start/end
	result := []int{start}
	for i := len(path) - 1; i >= 0; i-- {
		result = append(result, path[i])
	}
	result = append(result, end)

	return result
}

// Main function to optimize route and return ordered stop indices
func (r tspRoute) OptimalRoutes() optimalRoute {
	// Solve TSP
	or, err := func() (optimalRoute, error) {
		// TSP solver for fixed start and end points

		// Create list of all places: [start, stops..., end]
		var extra int

		if r.end == nil {
			extra = 1
		} else {
			extra = 2
		}

		n := len(r.stops) + extra

		allPlaces := make([]place, 0)
		allPlaces = append(allPlaces, r.start)
		allPlaces = append(allPlaces, r.stops...)

		if r.end != nil {
			allPlaces = append(allPlaces, *r.end)
		}

		startIdx := 0
		// endIdx := n - 1

		// Build distance matrix
		dist := make([][]float64, n)
		for i := range dist {
			dist[i] = make([]float64, n)
			for j := range dist[i] {
				dist[i][j] = allPlaces[i].euclideanDistanceTo(allPlaces[j])
			}
		}

		shortestPath := struct {
			minOrder []int
			distance float64
		}{minOrder: nil, distance: math.MaxFloat64}

		if r.end == nil {
			for i := range len(r.stops) {
				useAsEndIdx := i + 1
				o := solveTSPExact(dist, startIdx, useAsEndIdx)

				var d float64
				for i := range n - 1 {
					idxA := o[i]
					idxB := o[i+1]

					a := allPlaces[idxA]
					b := allPlaces[idxB]
					d += a.euclideanDistanceTo(b)
				}

				if d < shortestPath.distance {
					shortestPath.distance = d
					shortestPath.minOrder = o
				}
			}
		} else {
			o := solveTSPExact(dist, startIdx, n-1)
			shortestPath.minOrder = o

			shortestPath.distance = 0

			for i := range n - 1 {
				idxA := o[i]
				idxB := o[i+1]

				shortestPath.distance += dist[idxA][idxB]
			}

		}

		shortest := shortestPath.minOrder

		end := allPlaces[shortest[len(shortest)-1]]

		stops := make([]place, 0, len(shortest)-2)

		for i := 1; i < len(shortest)-1; i++ {
			s := allPlaces[shortest[i]]
			stops = append(stops, s)
		}

		return optimalRoute{End: end, Meters: shortestPath.distance * 1.1, Stops: stops}, nil
	}()

	if err != nil {
		panic(err)
	}

	return or
}

func (out tspRoute) convertDegreesToMeters() tspRoute {
	lt, lng := (func() (float64, float64) {
		// Find bounding box
		var minLat, maxLat, minLng, maxLng float64

		// start off with start
		minLat, minLng = out.start.lat, out.start.long
		maxLat, maxLng = minLat, minLng

		if out.end != nil {
			// do the end manually
			if out.end.lat < minLat {
				minLat = out.end.lat
			}
			if out.end.long < minLng {
				minLng = out.end.long
			}

			if out.end.lat > maxLat {
				maxLat = out.end.lat
			}
			if out.end.long > maxLng {
				maxLng = out.end.long
			}
		}

		// loop over stops
		for _, p := range out.stops {
			if p.lat < minLat {
				minLat = p.lat
			}
			if p.lat > maxLat {
				maxLat = p.lat
			}
			if p.long < minLng {
				minLng = p.long
			}
			if p.long > maxLng {
				maxLng = p.long
			}
		}

		// bounding box complete

		// Use center as reference point
		centerLat := (minLat + maxLat) / 2
		centerLng := (minLng + maxLng) / 2
		return centerLat, centerLng

	})()

	out.start = out.start.asRelativeCoords(lt, lng)

	if e := out.end; e != nil {
		newEnd := e.asRelativeCoords(lt, lng)
		out.end = &newEnd
	}

	for i, x := range out.stops {
		out.stops[i] = x.asRelativeCoords(lt, lng)
	}

	return out
}

type tspRouteBuilder struct {
	r tspRoute
}

func NewTspRouteBuilder() tspRouteBuilder {
	return tspRouteBuilder{tspRoute{}}
}

func (b tspRouteBuilder) WithStart(id string, lat, long float64) tspRouteBuilder {
	b.r.start = place{id, long, lat}
	return b
}

func (b tspRouteBuilder) WithEnd(id string, lat, long float64) tspRouteBuilder {
	b.r.end = &place{id, long, lat}
	return b
}

func (b tspRouteBuilder) AddStop(id string, lat, long float64) tspRouteBuilder {
	b.r.stops = append(b.r.stops, place{id, long, lat})
	return b
}

func (b tspRouteBuilder) Build() tspRoute {
	// First convert to 2D coordinates

	return b.r.convertDegreesToMeters()
}
