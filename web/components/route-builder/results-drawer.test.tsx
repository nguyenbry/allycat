import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render as rtlRender,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ResultsBody } from "./results-drawer";
import { type SavedRoute } from "./atoms";
import { type placeSchema } from "@/fetcher/fetchers";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  // Nothing in these tests may reach the network; each test opts in to a
  // stubbed response for the leg enrichment.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("network disabled in tests")))
  );
});

/** Responds to the leg-measuring call with `data`, or fails it when null. */
function stubLegs(data: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      data === null
        ? Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ message: "nope", data: null }),
          })
        : Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ message: null, data }),
          })
    )
  );
}

function render(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const wrap = (node: React.ReactElement) => (
    <QueryClientProvider client={client}>{node}</QueryClientProvider>
  );

  const utils = rtlRender(wrap(ui));

  // rerender would otherwise drop the provider and take the query client away.
  return {
    ...utils,
    rerender: (node: React.ReactElement) => utils.rerender(wrap(node)),
  };
}

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

describe("real distances enriching the solver estimate", () => {
  const legs = {
    legs: [
      { fromId: "start", toId: "b", meters: 3000, displayDistance: "1.9 mi", displayDuration: "9 mins" },
      { fromId: "b", toId: "c", meters: 4000, displayDistance: "2.5 mi", displayDuration: "12 mins" },
      { fromId: "c", toId: "d", meters: 5000, displayDistance: "3.1 mi", displayDuration: "15 mins" },
      { fromId: "d", toId: "a", meters: 2000, displayDistance: "1.2 mi", displayDuration: "6 mins" },
    ],
    meters: 14000,
    displayDistance: "8.7 mi",
    displayDuration: "42 mins",
  };

  const solverOnly: SavedRoute = {
    routes: [
      { destination: "a", method: "tsp", bike: leg(["b", "c", "d"], 8000) },
    ],
    places,
    startId: "start",
    endId: "a",
    calculatedAt: 1_700_000_000_000,
  };

  it("labels the solver distance as an estimate", () => {
    render(
      <ResultsBody isWorking={false} error={undefined} savedRoute={solverOnly} />
    );

    expect(screen.getByText("Estimated")).toBeDefined();
    expect(screen.getByText(/Straight-line distance between stops/)).toBeDefined();
  });

  it("shows the measured distance per hop once it arrives", async () => {
    stubLegs(legs);

    render(
      <ResultsBody isWorking={false} error={undefined} savedRoute={solverOnly} />
    );

    await waitFor(() => {
      expect(screen.getByText(/1\.9 mi/)).toBeDefined();
    });

    expect(screen.getByText(/2\.5 mi/)).toBeDefined();
    expect(screen.getByText(/3\.1 mi/)).toBeDefined();
    // The last stop has no next hop.
    expect(screen.queryAllByText(/1\.2 mi/).length).toBeGreaterThan(0);
  });

  it("shows the summed measured total in a badge beside the estimate", async () => {
    stubLegs(legs);

    render(
      <ResultsBody isWorking={false} error={undefined} savedRoute={solverOnly} />
    );

    // 3000 + 4000 + 5000 + 2000 = 14000 m = 8.7 mi, summed from the same legs
    // shown per row so the two can never disagree.
    await waitFor(() => {
      expect(screen.getByText("8.7 mi actual")).toBeDefined();
    });

    // The estimate stays visible right next to it.
    expect(screen.getByText("Estimated")).toBeDefined();
    expect(screen.getByText("5.0 mi")).toBeDefined();
  });

  it("shows no measured badge until the legs arrive", () => {
    render(
      <ResultsBody isWorking={false} error={undefined} savedRoute={solverOnly} />
    );

    expect(screen.queryByText(/mi actual/)).toBeNull();
  });

  it("still shows the route when measuring fails", async () => {
    stubLegs(null);

    render(
      <ResultsBody isWorking={false} error={undefined} savedRoute={solverOnly} />
    );

    // The production query retries once, so allow for that backoff.
    await waitFor(
      () => {
        expect(
          screen.getByText(/Couldn.t measure the real distances/)
        ).toBeDefined();
      },
      { timeout: 5000 }
    );

    // The whole point: the rider keeps the route regardless.
    expect(screen.getByText("Finish")).toBeDefined();
    expect(screen.getByText("5.0 mi")).toBeDefined();
  });
});
