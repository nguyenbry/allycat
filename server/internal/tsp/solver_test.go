package tsp

import (
	"math"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- geometry -------------------------------------------------------------

func TestEuclideanDistanceTo(t *testing.T) {
	t.Parallel()

	a := place{Id: "a", long: 0, lat: 0}
	b := place{Id: "b", long: 3, lat: 4}

	assert.InDelta(t, 5.0, a.euclideanDistanceTo(b), 1e-9)
	assert.InDelta(t, 5.0, b.euclideanDistanceTo(a), 1e-9, "distance must be symmetric")
	assert.Zero(t, a.euclideanDistanceTo(a))
}

func TestEuclideanDistanceObeysTriangleInequality(t *testing.T) {
	t.Parallel()

	a := place{long: 0, lat: 0}
	b := place{long: 5, lat: 1}
	c := place{long: 2, lat: 7}

	direct := a.euclideanDistanceTo(c)
	viaB := a.euclideanDistanceTo(b) + b.euclideanDistanceTo(c)

	assert.LessOrEqual(t, direct, viaB+1e-9)
}

func TestAsRelativeCoordsPutsCenterAtOrigin(t *testing.T) {
	t.Parallel()

	centerLat, centerLng := 39.95, -75.16

	p := place{Id: "p", lat: centerLat, long: centerLng}
	rel := p.asRelativeCoords(centerLat, centerLng)

	assert.InDelta(t, 0.0, rel.lat, 1e-9)
	assert.InDelta(t, 0.0, rel.long, 1e-9)
	assert.Equal(t, "p", rel.Id, "identity must be preserved through projection")
}

func TestAsRelativeCoordsConvertsDegreesToMeters(t *testing.T) {
	t.Parallel()

	centerLat, centerLng := 39.95, -75.16

	// One degree of latitude north.
	north := place{lat: centerLat + 1, long: centerLng}.
		asRelativeCoords(centerLat, centerLng)

	assert.InDelta(t, metersPerDegreeLat, north.lat, 1e-6)
	assert.InDelta(t, 0.0, north.long, 1e-6)

	// One degree of longitude east shrinks by cos(latitude).
	east := place{lat: centerLat, long: centerLng + 1}.
		asRelativeCoords(centerLat, centerLng)

	wantEast := 111320.0 * math.Cos(centerLat*math.Pi/180.0)
	assert.InDelta(t, wantEast, east.long, 1e-6)
	assert.Less(t, east.long, metersPerDegreeLat, "a degree of longitude is shorter than a degree of latitude at this latitude")
}

func TestAsRelativeCoordsDoesNotMutateReceiver(t *testing.T) {
	t.Parallel()

	p := place{Id: "p", lat: 40, long: -75}
	_ = p.asRelativeCoords(39.95, -75.16)

	assert.Equal(t, 40.0, p.lat)
	assert.Equal(t, -75.0, p.long)
}

func TestConvertDegreesToMetersCentersOnBoundingBox(t *testing.T) {
	t.Parallel()

	r := tspRoute{
		start: place{Id: "s", lat: 10, long: 20},
		end:   &place{Id: "e", lat: 30, long: 40},
		stops: []place{{Id: "a", lat: 20, long: 30}},
	}

	out := r.convertDegreesToMeters()

	// The bounding box spans 10..30 lat and 20..40 long, so its centre is the
	// stop at (20, 30) — which must land on the origin.
	assert.InDelta(t, 0.0, out.stops[0].lat, 1e-6)
	assert.InDelta(t, 0.0, out.stops[0].long, 1e-6)

	// Start is south-west of centre, end is north-east.
	assert.Negative(t, out.start.lat)
	assert.Negative(t, out.start.long)
	assert.Positive(t, out.end.lat)
	assert.Positive(t, out.end.long)
}

func TestConvertDegreesToMetersHandlesNilEnd(t *testing.T) {
	t.Parallel()

	r := tspRoute{
		start: place{Id: "s", lat: 10, long: 20},
		stops: []place{{Id: "a", lat: 20, long: 30}, {Id: "b", lat: 30, long: 40}},
	}

	out := r.convertDegreesToMeters()

	assert.Nil(t, out.end)
	assert.Len(t, out.stops, 2)
}

// --- solveTSPExact --------------------------------------------------------

// pathCost sums the legs of an ordered index path.
func pathCost(dist [][]float64, path []int) float64 {
	var total float64
	for i := 0; i < len(path)-1; i++ {
		total += dist[path[i]][path[i+1]]
	}
	return total
}

// bruteForceBest exhaustively permutes the intermediate nodes.
func bruteForceBest(dist [][]float64, start, end int) float64 {
	n := len(dist)

	intermediate := make([]int, 0, n-2)
	for i := 0; i < n; i++ {
		if i != start && i != end {
			intermediate = append(intermediate, i)
		}
	}

	best := math.Inf(1)

	var permute func(cur []int, remaining []int)
	permute = func(cur []int, remaining []int) {
		if len(remaining) == 0 {
			path := append([]int{start}, cur...)
			path = append(path, end)
			if c := pathCost(dist, path); c < best {
				best = c
			}
			return
		}

		for i := range remaining {
			next := append([]int{}, remaining[:i]...)
			next = append(next, remaining[i+1:]...)
			permute(append(cur, remaining[i]), next)
		}
	}

	permute([]int{}, intermediate)

	return best
}

// distanceMatrix builds a symmetric euclidean matrix from points.
func distanceMatrix(points []place) [][]float64 {
	n := len(points)
	dist := make([][]float64, n)

	for i := range dist {
		dist[i] = make([]float64, n)
		for j := range dist[i] {
			dist[i][j] = points[i].euclideanDistanceTo(points[j])
		}
	}

	return dist
}

func TestSolveTSPExactFindsOptimalPath(t *testing.T) {
	t.Parallel()

	// A deliberately awkward layout: the nearest-neighbour choice from the
	// start is not on the optimal path.
	points := []place{
		{Id: "start", long: 0, lat: 0},
		{Id: "a", long: 1, lat: 5},
		{Id: "b", long: 10, lat: 0},
		{Id: "c", long: 1, lat: -5},
		{Id: "end", long: 11, lat: 1},
	}

	dist := distanceMatrix(points)

	got := solveTSPExact(dist, 0, len(points)-1)

	require.Len(t, got, len(points))
	assert.Equal(t, 0, got[0], "path must begin at the start index")
	assert.Equal(t, len(points)-1, got[len(got)-1], "path must end at the end index")

	assert.InDelta(t, bruteForceBest(dist, 0, len(points)-1), pathCost(dist, got), 1e-9)
}

func TestSolveTSPExactMatchesBruteForceAcrossLayouts(t *testing.T) {
	t.Parallel()

	layouts := [][]place{
		{
			{long: 0, lat: 0}, {long: 1, lat: 1}, {long: 2, lat: 0}, {long: 3, lat: 1},
		},
		{
			{long: 0, lat: 0}, {long: 5, lat: 5}, {long: -5, lat: 5},
			{long: -5, lat: -5}, {long: 5, lat: -5}, {long: 0, lat: 10},
		},
		{
			{long: 0, lat: 0}, {long: 0.1, lat: 0.1}, {long: 100, lat: 0},
			{long: 0.2, lat: -0.1}, {long: 100, lat: 1},
		},
		{
			// Collinear points, where many orderings tie.
			{long: 0, lat: 0}, {long: 1, lat: 0}, {long: 2, lat: 0},
			{long: 3, lat: 0}, {long: 4, lat: 0},
		},
	}

	for i, points := range layouts {
		dist := distanceMatrix(points)
		end := len(points) - 1

		got := solveTSPExact(dist, 0, end)

		assert.InDelta(t,
			bruteForceBest(dist, 0, end),
			pathCost(dist, got),
			1e-9,
			"layout %d should be solved optimally", i,
		)
	}
}

func TestSolveTSPExactVisitsEveryNodeExactlyOnce(t *testing.T) {
	t.Parallel()

	points := []place{
		{long: 0, lat: 0}, {long: 3, lat: 4}, {long: -2, lat: 6},
		{long: 8, lat: 1}, {long: 5, lat: -3}, {long: 9, lat: 9},
	}

	got := solveTSPExact(distanceMatrix(points), 0, len(points)-1)

	require.Len(t, got, len(points))

	seen := make(map[int]int, len(points))
	for _, idx := range got {
		seen[idx]++
	}

	for i := range points {
		assert.Equal(t, 1, seen[i], "index %d should appear exactly once", i)
	}
}

func TestSolveTSPExactIsDeterministic(t *testing.T) {
	t.Parallel()

	points := []place{
		{long: 0, lat: 0}, {long: 3, lat: 4}, {long: -2, lat: 6}, {long: 8, lat: 1},
	}
	dist := distanceMatrix(points)

	first := solveTSPExact(dist, 0, 3)

	for range 20 {
		assert.Equal(t, first, solveTSPExact(dist, 0, 3))
	}
}

func TestSolveTSPExactSingleIntermediate(t *testing.T) {
	t.Parallel()

	points := []place{
		{Id: "s", long: 0, lat: 0},
		{Id: "mid", long: 1, lat: 1},
		{Id: "e", long: 2, lat: 2},
	}

	got := solveTSPExact(distanceMatrix(points), 0, 2)

	assert.Equal(t, []int{0, 1, 2}, got)
}

// --- OptimalRoutes --------------------------------------------------------

func routeFrom(start place, end *place, stops ...place) tspRoute {
	return tspRoute{start: start, end: end, stops: stops}
}

func TestOptimalRoutesWithFixedEnd(t *testing.T) {
	t.Parallel()

	start := place{Id: "start", lat: 39.95, long: -75.18}
	end := place{Id: "end", lat: 39.94, long: -75.17}

	stops := []place{
		{Id: "a", lat: 39.96, long: -75.19},
		{Id: "b", lat: 39.97, long: -75.20},
		{Id: "c", lat: 39.98, long: -75.21},
	}

	got := routeFrom(start, &end, stops...).convertDegreesToMeters().OptimalRoutes()

	assert.Equal(t, "end", got.End.Id, "a fixed end must be honoured")
	require.Len(t, got.Stops, len(stops))

	ids := make([]string, 0, len(got.Stops))
	for _, s := range got.Stops {
		ids = append(ids, s.Id)
	}
	assert.ElementsMatch(t, []string{"a", "b", "c"}, ids)
	assert.Positive(t, got.Meters)
}

func TestOptimalRoutesWithoutEndChoosesAStopAsFinish(t *testing.T) {
	t.Parallel()

	start := place{Id: "start", lat: 39.95, long: -75.18}

	stops := []place{
		{Id: "a", lat: 39.96, long: -75.19},
		{Id: "b", lat: 39.97, long: -75.20},
		{Id: "c", lat: 39.98, long: -75.21},
	}

	got := routeFrom(start, nil, stops...).convertDegreesToMeters().OptimalRoutes()

	assert.Contains(t, []string{"a", "b", "c"}, got.End.Id)

	// The chosen finish is not also listed as an intermediate stop.
	require.Len(t, got.Stops, len(stops)-1)

	for _, s := range got.Stops {
		assert.NotEqual(t, got.End.Id, s.Id)
		assert.NotEqual(t, "start", s.Id)
	}
}

func TestOptimalRoutesNeverIncludesStartAsAStop(t *testing.T) {
	t.Parallel()

	start := place{Id: "start", lat: 39.95, long: -75.18}
	end := place{Id: "end", lat: 39.94, long: -75.17}

	got := routeFrom(start, &end,
		place{Id: "a", lat: 39.96, long: -75.19},
		place{Id: "b", lat: 39.97, long: -75.20},
	).convertDegreesToMeters().OptimalRoutes()

	for _, s := range got.Stops {
		assert.NotEqual(t, "start", s.Id)
		assert.NotEqual(t, "end", s.Id)
	}
}

func TestOptimalRoutesAppliesDistanceFudgeFactor(t *testing.T) {
	t.Parallel()

	// Straight-line distance underestimates road distance, so the solver pads
	// its estimate by 10%.
	start := place{Id: "start", lat: 0, long: 0}
	end := place{Id: "end", lat: 0, long: 0.03}

	r := routeFrom(start, &end,
		place{Id: "a", lat: 0, long: 0.01},
		place{Id: "b", lat: 0, long: 0.02},
	).convertDegreesToMeters()

	got := r.OptimalRoutes()

	// Recompute the raw path length the solver would have measured.
	var raw float64
	prev := r.start
	for _, s := range got.Stops {
		raw += prev.euclideanDistanceTo(s)
		prev = s
	}
	raw += prev.euclideanDistanceTo(got.End)

	assert.InDelta(t, raw*1.1, got.Meters, 1e-6)
}

func TestOptimalRoutesIsDeterministic(t *testing.T) {
	t.Parallel()

	start := place{Id: "start", lat: 39.95, long: -75.18}
	end := place{Id: "end", lat: 39.94, long: -75.17}

	stops := []place{
		{Id: "a", lat: 39.96, long: -75.19},
		{Id: "b", lat: 39.97, long: -75.20},
		{Id: "c", lat: 39.98, long: -75.21},
		{Id: "d", lat: 39.99, long: -75.22},
	}

	first := routeFrom(start, &end, stops...).convertDegreesToMeters().OptimalRoutes()

	for range 10 {
		again := routeFrom(start, &end, stops...).convertDegreesToMeters().OptimalRoutes()

		assert.Equal(t, first.End.Id, again.End.Id)
		assert.InDelta(t, first.Meters, again.Meters, 1e-9)

		require.Len(t, again.Stops, len(first.Stops))
		for i := range first.Stops {
			assert.Equal(t, first.Stops[i].Id, again.Stops[i].Id)
		}
	}
}

func TestOptimalRoutesPicksShorterOfTwoObviousFinishes(t *testing.T) {
	t.Parallel()

	// Two stops sit close to the start and one is far away; finishing at the
	// far one avoids doubling back, so it should win.
	start := place{Id: "start", lat: 0, long: 0}

	got := routeFrom(start, nil,
		place{Id: "near1", lat: 0, long: 0.001},
		place{Id: "near2", lat: 0, long: 0.002},
		place{Id: "far", lat: 0, long: 0.05},
	).convertDegreesToMeters().OptimalRoutes()

	assert.Equal(t, "far", got.End.Id)
}

func TestBuilderProducesProjectedRoute(t *testing.T) {
	t.Parallel()

	// Build() projects to metres, so the stored values must no longer be the
	// degrees that were passed in.
	r := NewTspRouteBuilder().
		WithStart("s", 39.95, -75.18).
		AddStop("a", 39.96, -75.19).
		AddStop("b", 39.97, -75.20).
		WithEnd("e", 39.94, -75.17).
		Build()

	assert.NotEqual(t, 39.95, r.start.lat)
	assert.Greater(t, math.Abs(r.start.lat), 1.0, "metres, not degrees")

	require.NotNil(t, r.end)
	assert.Equal(t, "e", r.end.Id)
	assert.Len(t, r.stops, 2)
}

func TestBuilderStoresLatAndLongInCorrectFields(t *testing.T) {
	t.Parallel()

	// The builder signature is (id, lat, long) but the struct literal is
	// {id, long, lat}; a swap here would corrupt every route silently.
	b := NewTspRouteBuilder().WithStart("s", 10, 20)

	assert.Equal(t, 10.0, b.r.start.lat)
	assert.Equal(t, 20.0, b.r.start.long)

	b = b.AddStop("a", 30, 40).WithEnd("e", 50, 60)

	assert.Equal(t, 30.0, b.r.stops[0].lat)
	assert.Equal(t, 40.0, b.r.stops[0].long)
	assert.Equal(t, 50.0, b.r.end.lat)
	assert.Equal(t, 60.0, b.r.end.long)
}

func TestBuilderIsValueSemantic(t *testing.T) {
	t.Parallel()

	base := NewTspRouteBuilder().WithStart("s", 1, 2)

	withA := base.AddStop("a", 3, 4)
	withB := base.AddStop("b", 5, 6)

	assert.Len(t, withA.r.stops, 1)
	assert.Len(t, withB.r.stops, 1)
	assert.Equal(t, "a", withA.r.stops[0].Id)
	assert.Equal(t, "b", withB.r.stops[0].Id)
}

func TestExcludeAtDoesNotAliasInput(t *testing.T) {
	t.Parallel()

	original := []string{"a", "b", "c"}
	got := excludeAt(original, 1)

	got[0] = "mutated"

	assert.Equal(t, []string{"a", "b", "c"}, original, "result must not share backing memory")
}

func TestExcludeAtEmptySlice(t *testing.T) {
	t.Parallel()

	assert.Empty(t, excludeAt([]string{}, 0))
}
