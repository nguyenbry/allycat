import { beforeEach, describe, expect, it } from "vitest";
import { createStore } from "jotai";
import {
  discardRouteAtom,
  savedRouteAtom,
  startNewRouteAtom,
  toggleVisitedAtom,
  visitedIdsAtom,
  type SavedRoute,
} from "./atoms";

let store: ReturnType<typeof createStore>;

beforeEach(() => {
  window.localStorage.clear();
  store = createStore();
});

const route: SavedRoute = {
  routes: [],
  places: [],
  startId: "start",
  endId: undefined,
  calculatedAt: 1_700_000_000_000,
};

describe("ticking stops off", () => {
  it("starts with nothing visited", () => {
    expect(store.get(visitedIdsAtom)).toEqual([]);
  });

  it("toggles a stop on and back off", () => {
    store.set(toggleVisitedAtom, "a");
    expect(store.get(visitedIdsAtom)).toEqual(["a"]);

    store.set(toggleVisitedAtom, "a");
    expect(store.get(visitedIdsAtom)).toEqual([]);
  });

  it("tracks several stops independently", () => {
    store.set(toggleVisitedAtom, "a");
    store.set(toggleVisitedAtom, "b");
    store.set(toggleVisitedAtom, "c");
    store.set(toggleVisitedAtom, "b");

    expect(store.get(visitedIdsAtom)).toEqual(["a", "c"]);
  });

  it("never records the same stop twice", () => {
    store.set(visitedIdsAtom, ["a"]);
    store.set(toggleVisitedAtom, "a");
    store.set(toggleVisitedAtom, "a");

    expect(store.get(visitedIdsAtom)).toEqual(["a"]);
  });

  it("persists so progress survives the tab being evicted mid-race", () => {
    store.set(toggleVisitedAtom, "a");

    const raw = window.localStorage.getItem("allycat-visited-ids");
    if (raw === null) throw new Error("expected visited ids to be persisted");
    expect(JSON.parse(raw)).toEqual(["a"]);
  });

  it("is cleared when the route is discarded", () => {
    store.set(savedRouteAtom, route);
    store.set(toggleVisitedAtom, "a");

    store.set(discardRouteAtom);

    // Progress belongs to the discarded route, not the stop list.
    expect(store.get(visitedIdsAtom)).toEqual([]);
  });

  it("is cleared when starting a new route", () => {
    store.set(toggleVisitedAtom, "a");

    store.set(startNewRouteAtom);

    expect(store.get(visitedIdsAtom)).toEqual([]);
  });
});
