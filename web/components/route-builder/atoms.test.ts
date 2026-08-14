import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStore } from "jotai";
import {
  baseLocationAtom,
  calculateRequestedAtom,
  discardRouteAtom,
  endIdAtom,
  endPlaceAtom,
  intermediateStopsAtom,
  queryAtom,
  resultsOpenAtom,
  savedRouteAtom,
  selectedPlacesAtom,
  startIdAtom,
  startNewRouteAtom,
  startPlaceAtom,
  type SavedRoute,
} from "./atoms";
import { type placeSchema } from "@/fetcher/fetchers";

function place(id: string, name = id): placeSchema {
  return {
    id,
    formattedAddress: `${name}, Philadelphia, PA, USA`,
    googleMapsUri: `https://maps.google.com/?cid=${id}`,
    displayName: { text: name },
    googleMapsLinks: { directionsUri: `https://maps.google.com/dir/${id}` },
    location: { longitude: -75.16, latitude: 39.95 },
  };
}

/** Narrows a persisted value, failing loudly rather than casting past null. */
function required(value: string | null): string {
  if (value === null) {
    throw new Error("expected a value to have been persisted");
  }
  return value;
}

// A fresh store per test; the atoms are persisted, so clear storage too.
function freshStore() {
  window.localStorage.clear();
  return createStore();
}

let store: ReturnType<typeof createStore>;

beforeEach(() => {
  store = freshStore();
});

describe("derived route state", () => {
  it("resolves the start place from its id", () => {
    const a = place("a");
    store.set(selectedPlacesAtom, [a, place("b")]);
    store.set(startIdAtom, "a");

    expect(store.get(startPlaceAtom)).toEqual(a);
  });

  it("has no start place when no id is set", () => {
    store.set(selectedPlacesAtom, [place("a")]);

    expect(store.get(startPlaceAtom)).toBeUndefined();
  });

  it("has no start place when the id no longer matches a selected place", () => {
    store.set(selectedPlacesAtom, [place("a")]);
    store.set(startIdAtom, "removed");

    expect(store.get(startPlaceAtom)).toBeUndefined();
  });

  it("resolves the end place from its id", () => {
    const b = place("b");
    store.set(selectedPlacesAtom, [place("a"), b]);
    store.set(endIdAtom, "b");

    expect(store.get(endPlaceAtom)).toEqual(b);
  });

  it("treats everything that is not the start or end as an intermediate stop", () => {
    store.set(selectedPlacesAtom, [
      place("start"),
      place("a"),
      place("b"),
      place("end"),
    ]);
    store.set(startIdAtom, "start");
    store.set(endIdAtom, "end");

    expect(store.get(intermediateStopsAtom).map((p) => p.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("counts every non-start place as intermediate when there is no end", () => {
    store.set(selectedPlacesAtom, [place("start"), place("a"), place("b")]);
    store.set(startIdAtom, "start");

    expect(store.get(intermediateStopsAtom).map((p) => p.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("preserves the order places were added in", () => {
    store.set(selectedPlacesAtom, [place("c"), place("a"), place("b")]);

    expect(store.get(intermediateStopsAtom).map((p) => p.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("never lists a place as both the start and an intermediate stop", () => {
    store.set(selectedPlacesAtom, [place("start"), place("a"), place("b")]);
    store.set(startIdAtom, "start");

    const ids = store.get(intermediateStopsAtom).map((p) => p.id);

    expect(ids).not.toContain("start");
  });

  it("drops a place from intermediates once it becomes the end", () => {
    store.set(selectedPlacesAtom, [place("start"), place("a"), place("b")]);
    store.set(startIdAtom, "start");

    expect(store.get(intermediateStopsAtom)).toHaveLength(2);

    store.set(endIdAtom, "b");

    expect(store.get(intermediateStopsAtom).map((p) => p.id)).toEqual(["a"]);
  });
});

describe("base location", () => {
  it("is optional and starts unset", () => {
    expect(store.get(baseLocationAtom)).toBeUndefined();
  });

  it("holds the whole place, not just an id, so its coordinates can bias searches", () => {
    const cityHall = place("ch", "Philadelphia City Hall");
    store.set(baseLocationAtom, cityHall);

    expect(store.get(baseLocationAtom)?.location).toEqual({
      longitude: -75.16,
      latitude: 39.95,
    });
  });

  it("does not need to be one of the selected stops", () => {
    store.set(baseLocationAtom, place("ch", "Philadelphia City Hall"));
    store.set(selectedPlacesAtom, [place("a"), place("b")]);

    expect(
      store.get(selectedPlacesAtom).some((p) => p.id === "ch")
    ).toBe(false);
    expect(store.get(baseLocationAtom)).toBeDefined();
  });
});

function savedRoute(): SavedRoute {
  return {
    routes: [
      {
        destination: "end",
        bike: {
          order: ["a", "b"],
          meters: 1000,
          displayDistance: "0.6 mi",
          displayDuration: "5 mins",
        },
      },
    ],
    places: [place("start"), place("a"), place("b"), place("end")],
    startId: "start",
    endId: "end",
    calculatedAt: 1_700_000_000_000,
  };
}

describe("discarding and restarting", () => {
  it("discard clears the finished route but keeps the stops", () => {
    store.set(selectedPlacesAtom, [place("start"), place("a"), place("b")]);
    store.set(startIdAtom, "start");
    store.set(savedRouteAtom, savedRoute());
    store.set(resultsOpenAtom, true);
    store.set(calculateRequestedAtom, true);

    store.set(discardRouteAtom);

    expect(store.get(savedRouteAtom)).toBeNull();
    expect(store.get(resultsOpenAtom)).toBe(false);
    expect(store.get(calculateRequestedAtom)).toBe(false);

    // Stops survive so the same sheet can be recalculated.
    expect(store.get(selectedPlacesAtom)).toHaveLength(3);
    expect(store.get(startIdAtom)).toBe("start");
  });

  it("new route wipes the whole session", () => {
    store.set(selectedPlacesAtom, [place("start"), place("a"), place("b")]);
    store.set(startIdAtom, "start");
    store.set(endIdAtom, "b");
    store.set(queryAtom, "market st");
    store.set(savedRouteAtom, savedRoute());
    store.set(resultsOpenAtom, true);

    store.set(startNewRouteAtom);

    expect(store.get(savedRouteAtom)).toBeNull();
    expect(store.get(selectedPlacesAtom)).toEqual([]);
    expect(store.get(startIdAtom)).toBeUndefined();
    expect(store.get(endIdAtom)).toBeUndefined();
    expect(store.get(queryAtom)).toBe("");
    expect(store.get(resultsOpenAtom)).toBe(false);
  });

  it("new route keeps the base location, since the city has not changed", () => {
    const cityHall = place("ch", "Philadelphia City Hall");
    store.set(baseLocationAtom, cityHall);
    store.set(selectedPlacesAtom, [place("a")]);

    store.set(startNewRouteAtom);

    expect(store.get(baseLocationAtom)).toEqual(cityHall);
  });
});

describe("persistence", () => {
  it("writes selected places to localStorage", () => {
    store.set(selectedPlacesAtom, [place("a")]);

    const raw = window.localStorage.getItem("allycat-places");
    expect(raw).not.toBeNull();
    expect(JSON.parse(required(raw))).toHaveLength(1);
  });

  it("writes the finished route to localStorage so it survives a tab kill", () => {
    store.set(savedRouteAtom, savedRoute());

    const raw = window.localStorage.getItem("allycat-saved-route");
    expect(raw).not.toBeNull();

    const parsed = JSON.parse(required(raw)) as SavedRoute;
    expect(parsed.startId).toBe("start");
    expect(parsed.routes[0]?.bike?.order).toEqual(["a", "b"]);
  });

  it("restores a saved route on a fresh page load", async () => {
    store.set(savedRouteAtom, savedRoute());

    const persisted = window.localStorage.getItem("allycat-saved-route");
    expect(persisted).not.toBeNull();

    // Reopening the app re-evaluates the module, which is when the persisted
    // atoms read storage — a new store alone reuses the existing atom init.
    vi.resetModules();
    window.localStorage.setItem("allycat-saved-route", required(persisted));

    const reloaded = await import("./atoms");
    const reopened = createStore();

    expect(reopened.get(reloaded.savedRouteAtom)?.startId).toBe("start");
    expect(reopened.get(reloaded.savedRouteAtom)?.calculatedAt).toBe(
      1_700_000_000_000
    );
  });

  it("restores the stop list and base location on a fresh page load", async () => {
    store.set(selectedPlacesAtom, [place("start"), place("a")]);
    store.set(startIdAtom, "start");
    store.set(baseLocationAtom, place("ch", "Philadelphia City Hall"));

    const snapshot = {
      places: window.localStorage.getItem("allycat-places"),
      startId: window.localStorage.getItem("allycat-start-id"),
      base: window.localStorage.getItem("allycat-base-location"),
    };

    vi.resetModules();
    window.localStorage.setItem("allycat-places", required(snapshot.places));
    window.localStorage.setItem("allycat-start-id", required(snapshot.startId));
    window.localStorage.setItem("allycat-base-location", required(snapshot.base));

    const reloaded = await import("./atoms");
    const reopened = createStore();

    expect(reopened.get(reloaded.selectedPlacesAtom)).toHaveLength(2);
    expect(reopened.get(reloaded.startIdAtom)).toBe("start");
    expect(reopened.get(reloaded.baseLocationAtom)?.displayName.text).toBe(
      "Philadelphia City Hall"
    );
  });

  it("carries the place snapshot so results still render after stops change", () => {
    store.set(savedRouteAtom, savedRoute());
    // The rider edits the sheet after calculating.
    store.set(selectedPlacesAtom, []);

    const saved = store.get(savedRouteAtom);

    expect(saved?.places).toHaveLength(4);
    expect(saved?.places.find((p) => p.id === "a")?.displayName.text).toBe("a");
  });

  it("does not persist transient UI state", () => {
    store.set(resultsOpenAtom, true);
    store.set(calculateRequestedAtom, true);
    store.set(queryAtom, "typing");

    expect(window.localStorage.getItem("allycat-resultsOpen")).toBeNull();
    expect(window.localStorage.getItem("allycat-query")).toBeNull();

    // A reopened app must not think a calculation is still in flight.
    const reopened = createStore();
    expect(reopened.get(calculateRequestedAtom)).toBe(false);
    expect(reopened.get(resultsOpenAtom)).toBe(false);
  });
});
