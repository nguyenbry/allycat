import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ResultsBody } from "./results-drawer";
import { type SavedRoute } from "./atoms";
import { type placeSchema } from "@/fetcher/fetchers";

afterEach(cleanup);

function place(id: string): placeSchema {
  return {
    id,
    formattedAddress: `${id} St, Philadelphia, PA, USA`,
    googleMapsUri: `https://maps.google.com/?cid=${id}`,
    displayName: { text: id },
    googleMapsLinks: { directionsUri: `https://maps.google.com/dir/${id}` },
    location: { longitude: -75.16, latitude: 39.95 },
  };
}

const places = ["start", "a", "b", "c", "d"].map(place);

function leg(order: string[], meters: number) {
  return {
    order,
    meters,
    displayDistance: `${(meters / 1609).toFixed(1)} mi`,
    displayDuration: "10 mins",
  };
}

/**
 * Shapes taken from real production responses. The important detail is that
 * the solver entry always shares its `destination` with one of the Google
 * entries — verified live: a fixed-destination request returns 2 entries with
 * 1 unique destination, and a variable-destination request returned 9 entries
 * with 8 unique destinations.
 */
const noEndResult: SavedRoute = {
  routes: [
    { destination: "d", method: "tsp", bike: leg(["a", "b", "c"], 9000) },
    { destination: "d", bike: leg(["a", "c", "b"], 11000) },
    { destination: "c", bike: leg(["a", "b", "d"], 12000) },
    { destination: "b", bike: leg(["a", "c", "d"], 13000) },
  ],
  places,
  startId: "start",
  endId: undefined,
  calculatedAt: 1_700_000_000_000,
};

const fixedEndResult: SavedRoute = {
  routes: [
    { destination: "a", method: "tsp", bike: leg(["b", "c", "d"], 8000) },
    {
      destination: "a",
      bike: leg(["b", "d", "c"], 9500),
      car: leg(["d", "c", "b"], 9000),
    },
  ],
  places,
  startId: "start",
  endId: "a",
  calculatedAt: 1_700_000_100_000,
};

function cardCount() {
  // One "Finish" label is rendered per destination card.
  return screen.queryAllByText("Finish").length;
}

describe("results list", () => {
  it("renders one card per returned route when there is no fixed end", () => {
    render(
      <ResultsBody isWorking={false} error={undefined} savedRoute={noEndResult} />
    );

    expect(cardCount()).toBe(noEndResult.routes.length);
  });

  it("renders one card per returned route for a fixed end", () => {
    render(
      <ResultsBody
        isWorking={false}
        error={undefined}
        savedRoute={fixedEndResult}
      />
    );

    expect(cardCount()).toBe(fixedEndResult.routes.length);
  });

  // The reported bug: calculate with no end, then set an end and recalculate,
  // and the sheet showed the old results alongside the new ones.
  it("replaces the previous results when the route is recalculated with an end", () => {
    const { rerender } = render(
      <ResultsBody isWorking={false} error={undefined} savedRoute={noEndResult} />
    );

    expect(cardCount()).toBe(4);

    rerender(
      <ResultsBody
        isWorking={false}
        error={undefined}
        savedRoute={fixedEndResult}
      />
    );

    expect(cardCount()).toBe(2);

    // Stops that only existed in the old result must be gone entirely.
    expect(screen.queryByText("11.0 mi")).toBeNull();
    expect(screen.queryByText("12.0 mi")).toBeNull();
    expect(screen.queryByText("13.0 mi")).toBeNull();
  });

  it("keeps both the solver and Google entries for the same finish", () => {
    render(
      <ResultsBody
        isWorking={false}
        error={undefined}
        savedRoute={fixedEndResult}
      />
    );

    // They share a destination, so a destination-only key would drop one.
    expect(screen.queryAllByText("Solver")).toHaveLength(1);
    expect(cardCount()).toBe(2);
  });
});
