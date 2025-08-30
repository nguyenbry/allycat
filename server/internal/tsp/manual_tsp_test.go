package tsp

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestExcludeAt(t *testing.T) {
	res := excludeAt([]string{"a", "b"}, 0)

	assert.Equal(t, []string{"b"}, res)
}

func TestExcludeAt2(t *testing.T) {
	res := excludeAt([]string{"a", "b"}, 1)

	assert.Equal(t, []string{"a"}, res)
}

func TestExcludeAtInvalidIdx(t *testing.T) {
	res := excludeAt([]string{"a", "b"}, 2)

	assert.Equal(t, []string{"a", "b"}, res)
}

func TestExcludeAtInvalidIdx2(t *testing.T) {
	res := excludeAt([]string{"a", "b"}, -1)

	assert.Equal(t, []string{"a", "b"}, res)
}

func TestCitywideAlleycatRouteWithEnd(t *testing.T) {
	graysFerSkatePark := place{
		Id:   "ChIJc7SgtIvGxokRPBKj0H0XXPQ",
		long: -75.20420159999999,
		lat:  39.9409798,
	}

	barnes := place{
		Id:   "ChIJrcsBU8vHxokR4FXP2BplJks",
		long: -75.17280749999999,
		lat:  39.9606433,
	}
	n11th_2400 := place{
		Id:   "ChIJcRzlRgbIxokR1yUtRPv8u4I",
		long: -75.1506503,
		lat:  39.9891357,
	}
	innYardPark := place{
		Id:   "ChIJkTEFDHy4xokR3y81rj83fmI",
		long: -75.1953324,
		lat:  40.0090982,
	}
	tshat := place{
		Id:   "ChIJ38WZZl3JxokRvVzKlOrKDOw",
		long: -75.1019638,
		lat:  39.9829054,
	}
	the700 := place{
		Id:   "ChIJHxQlmGTIxokRVN3mcBkfOIk",
		long: -75.1413974,
		lat:  39.9620591,
	}
	roseGarden := place{
		Id:   "ChIJ1waJqZzIxokR49XlZ1tqfnw",
		long: -75.1488246,
		lat:  39.94694,
	}
	locustBar := place{
		Id:   "ChIJb6_MyifGxokRpoGQe70D8ek",
		long: -75.1575275,
		lat:  39.9472387,
	}
	broadMckean := place{
		Id:   "ChIJqWIkSA_GxokRc4T8-pBAwbU",
		long: -75.16747749999999,
		lat:  39.925222399999996,
	}
	whartonSq := place{
		Id:   "ChIJS_Tsp27GxokRNn46MDX2rrM",
		long: -75.1837832,
		lat:  39.9360454,
	}
	fitlerSq := place{
		Id:   "ChIJIQ0RF0fGxokRRBPTCYK7s-o",
		long: -75.1793444,
		lat:  39.9474746,
	}
	saundersPark := place{
		Id:   "ChIJT1ozjUvHxokR3LneNPIS4qE",
		long: -75.19938719999999,
		lat:  39.9600151,
	}
	clarkPark := place{
		Id:   "ChIJbyyRSfLGxokRDJARJE7eV9o",
		long: -75.2104142,
		lat:  39.9488973,
	}

	a := tspRoute{
		start: place{
			Id:   "ChIJmZ0KYn_IxokRIBmPHZq5kPc",
			long: -75.1545378,
			lat:  39.9614429,
		},
		end: &graysFerSkatePark,
		stops: []place{
			n11th_2400,
			innYardPark,
			tshat,
			the700,
			roseGarden,
			locustBar,
			broadMckean,
			whartonSq,
			fitlerSq,
			barnes,
			saundersPark,
			clarkPark,
		},
	}

	o := a.convertDegreesToMeters().OptimalRoutes()

	expectedOrder := []place{barnes, fitlerSq, whartonSq, broadMckean, locustBar, roseGarden, the700, tshat, n11th_2400, innYardPark, saundersPark, clarkPark}

	expectedIds := make([]string, 0, len(expectedOrder))

	for _, x := range expectedOrder {
		expectedIds = append(expectedIds, x.Id)
	}

	actualIds := make([]string, 0, len(o.Stops))

	for _, x := range o.Stops {
		actualIds = append(actualIds, x.Id)
	}

	// assert.Equal(t, optimalRoute{
	// 	End:    graysFerSkatePark,
	// 	Meters: 7,
	// 	Stops:  []place{barnes, fitlerSq, whartonSq, broadMckean, locustBar, roseGarden, the700, tshat, n11th_2400, innYardPark, saundersPark, clarkPark},
	// }, o)

	assert.Equal(t, expectedIds, actualIds)
	assert.Equal(t, 35290, int(o.Meters))
	assert.Equal(t, graysFerSkatePark.Id, o.End.Id)
}

func TestCitywideAlleycatRouteWithoutEnd(t *testing.T) {
	barnes := place{
		Id:   "ChIJrcsBU8vHxokR4FXP2BplJks",
		long: -75.17280749999999,
		lat:  39.9606433,
	}
	n11th_2400 := place{
		Id:   "ChIJcRzlRgbIxokR1yUtRPv8u4I",
		long: -75.1506503,
		lat:  39.9891357,
	}
	innYardPark := place{
		Id:   "ChIJkTEFDHy4xokR3y81rj83fmI",
		long: -75.1953324,
		lat:  40.0090982,
	}
	tshat := place{
		Id:   "ChIJ38WZZl3JxokRvVzKlOrKDOw",
		long: -75.1019638,
		lat:  39.9829054,
	}
	the700 := place{
		Id:   "ChIJHxQlmGTIxokRVN3mcBkfOIk",
		long: -75.1413974,
		lat:  39.9620591,
	}
	roseGarden := place{
		Id:   "ChIJ1waJqZzIxokR49XlZ1tqfnw",
		long: -75.1488246,
		lat:  39.94694,
	}
	locustBar := place{
		Id:   "ChIJb6_MyifGxokRpoGQe70D8ek",
		long: -75.1575275,
		lat:  39.9472387,
	}
	broadMckean := place{
		Id:   "ChIJqWIkSA_GxokRc4T8-pBAwbU",
		long: -75.16747749999999,
		lat:  39.925222399999996,
	}
	whartonSq := place{
		Id:   "ChIJS_Tsp27GxokRNn46MDX2rrM",
		long: -75.1837832,
		lat:  39.9360454,
	}
	fitlerSq := place{
		Id:   "ChIJIQ0RF0fGxokRRBPTCYK7s-o",
		long: -75.1793444,
		lat:  39.9474746,
	}
	saundersPark := place{
		Id:   "ChIJT1ozjUvHxokR3LneNPIS4qE",
		long: -75.19938719999999,
		lat:  39.9600151,
	}
	clarkPark := place{
		Id:   "ChIJbyyRSfLGxokRDJARJE7eV9o",
		long: -75.2104142,
		lat:  39.9488973,
	}

	a := tspRoute{
		start: place{
			Id:   "ChIJmZ0KYn_IxokRIBmPHZq5kPc",
			long: -75.1545378,
			lat:  39.9614429,
		},
		end: nil,
		stops: []place{
			n11th_2400,
			innYardPark,
			tshat,
			the700,
			roseGarden,
			locustBar,
			broadMckean,
			whartonSq,
			fitlerSq,
			barnes,
			saundersPark,
			clarkPark,
		},
	}

	o := a.convertDegreesToMeters().OptimalRoutes()

	expectedOrder := []place{barnes, saundersPark, clarkPark, fitlerSq, whartonSq, broadMckean, locustBar, roseGarden, the700, tshat, n11th_2400}

	expectedIds := make([]string, 0, len(expectedOrder))

	for _, x := range expectedOrder {
		expectedIds = append(expectedIds, x.Id)
	}

	actualIds := make([]string, 0, len(o.Stops))

	for _, x := range o.Stops {
		actualIds = append(actualIds, x.Id)
	}

	assert.Equal(t, expectedIds, actualIds)
	assert.Equal(t, 31886, int(o.Meters))
	assert.Equal(t, innYardPark.Id, o.End.Id)
}

func TestRandomRouteWithEnd(t *testing.T) {
	// Origin
	mcclellanSt := place{
		Id:   "ChIJHQTP5KjIxokRwvt_H8qZNxE",
		long: -75.15086459999999,
		lat:  39.9253374,
	}

	// Destination
	cityHall := place{
		Id:   "ChIJyb-70KChxokR5YR1l-Nka5s",
		long: -75.1634833,
		lat:  39.952799999999996,
	}

	// Stops
	blackwellCenter := place{
		Id:   "ChIJHww9wjPHxokR6VUZsRy25XE",
		long: -75.2147225,
		lat:  39.9655661,
	}

	hamiltonSchool := place{
		Id:   "ChIJNww8hMXGxokRvGvy72g0JfQ",
		long: -75.2353354,
		lat:  39.955224099999995,
	}

	pentridgeStation := place{
		Id:   "ChIJectLYZXGxokROSLK9FIVdbk",
		long: -75.2242489,
		lat:  39.9455095,
	}

	lanierPlayground := place{
		Id:   "ChIJbfeERKXIxokRwfCFeGe7TuA",
		long: -75.19376369999999,
		lat:  39.9334144,
	}

	mccallSchool := place{
		Id:   "ChIJXYg8l53IxokRJ3lXDA4yMlg",
		long: -75.15257629999999,
		lat:  39.9445741,
	}

	laColombe := place{
		Id:   "ChIJL4OUUjfGxokRWbdDe02buok",
		long: -75.1723193,
		lat:  39.950756399999996,
	}

	everyThai := place{
		Id:   "ChIJ2dPgSaHHxokRgIdEOlVosSs",
		long: -75.1604778,
		lat:  39.920185499999995,
	}

	franklinSquare := place{
		Id:   "ChIJ1U-L54DIxokRcoW6JtzjcDM",
		long: -75.1504502,
		lat:  39.9556634,
	}

	campbellSquare := place{
		Id:   "ChIJH6So9NPJxokReIgxzWN0z2Y",
		long: -75.10327149999999,
		lat:  39.986363499999996,
	}

	balbiFoodMarket := place{
		Id:   "ChIJc5lclQLIxokRZB4fbUrBczM",
		long: -75.14434899999999,
		lat:  39.995711199999995,
	}

	mediatorLutheran := place{
		Id:   "ChIJSSFcPfXHxokRX5o8AacIqq8",
		long: -75.1765994,
		lat:  39.9994607,
	}

	// Test route
	a := tspRoute{
		start: mcclellanSt,
		end:   &cityHall,
		stops: []place{
			blackwellCenter,
			hamiltonSchool,
			pentridgeStation,
			lanierPlayground,
			mccallSchool,
			laColombe,
			everyThai,
			franklinSquare,
			campbellSquare,
			balbiFoodMarket,
			mediatorLutheran,
		},
	}

	o := a.convertDegreesToMeters().OptimalRoutes()

	expectedOrder := []place{everyThai,
		lanierPlayground,
		pentridgeStation,
		hamiltonSchool,
		blackwellCenter,
		mediatorLutheran,
		balbiFoodMarket,
		campbellSquare,
		franklinSquare,
		mccallSchool,
		laColombe}

	expectedIds := make([]string, 0, len(expectedOrder))

	for _, x := range expectedOrder {
		expectedIds = append(expectedIds, x.Id)
	}

	actualIds := make([]string, 0, len(o.Stops))

	for _, x := range o.Stops {
		actualIds = append(actualIds, x.Id)
	}

	assert.Equal(t, expectedIds, actualIds)
	assert.Equal(t, 34270, int(o.Meters))
	assert.Equal(t, cityHall.Id, o.End.Id)
}
