import {
  type placeSchema,
  type routesPerDestinationSchema,
} from "@/fetcher/fetchers";
import { atom, type ExtractAtomValue } from "jotai";
import { atomWithStorage, createJSONStorage, splitAtom } from "jotai/utils";
import { getSafeStorage } from "@/lib/safe-storage";

export const queryAtom = atom("");

/**
 * Everything below is persisted to localStorage on purpose.
 *
 * The app is used from a phone mid-race, where Safari will happily evict the
 * tab's process. Losing the route you just paid Google to compute — while
 * riding — is the failure this guards against. It is only restored once the
 * app has mounted (see PasswordGate), so SSR and the client agree.
 */
const STORAGE_PREFIX = "allycat";

/**
 * `getOnInit` so a returning rider sees their route immediately rather than
 * after a frame; safe because the tree is only mounted post-hydration.
 */
function persistentAtom<T>(key: string, initial: T) {
  return atomWithStorage<T>(
    `${STORAGE_PREFIX}-${key}`,
    initial,
    createJSONStorage<T>(() => getSafeStorage()),
    { getOnInit: true }
  );
}

export const selectedPlacesAtom = persistentAtom<placeSchema[]>("places", []);

export const selectedPlacesAtomsAtom = splitAtom(
  selectedPlacesAtom,
  (x) => x.id
);

/**
 * The "base location" — an optional anchor that biases every subsequent
 * places search toward one area. Typically city hall of whatever city the
 * race is in, because race sheets list bare street addresses with no city.
 *
 * Holds the whole place (not just an id) because it is chosen by its own
 * search and is deliberately *not* required to be one of the route's stops.
 */
export const baseLocationAtom = persistentAtom<placeSchema | undefined>(
  "base-location",
  undefined
);

export const startIdAtom = persistentAtom<string | undefined>(
  "start-id",
  undefined
);

export const endIdAtom = persistentAtom<string | undefined>(
  "end-id",
  undefined
);

/**
 * A finished calculation, kept until explicitly discarded.
 *
 * Carries its own snapshot of the places it was built from so that editing
 * the stop list afterwards can never leave the saved result unable to render
 * the names and addresses it references by id.
 */
export type SavedRoute = {
  routes: routesPerDestinationSchema[];
  places: placeSchema[];
  startId: string;
  endId: string | undefined;
  calculatedAt: number;
};

export const savedRouteAtom = persistentAtom<SavedRoute | null>(
  "saved-route",
  null
);

/**
 * Ids of stops already ticked off, persisted so the progress survives the tab
 * being evicted mid-race. Purely a visual marker — it never affects routing.
 */
export const visitedIdsAtom = persistentAtom<string[]>("visited-ids", []);

export const toggleVisitedAtom = atom(null, (get, set, id: string) => {
  const visited = get(visitedIdsAtom);

  set(
    visitedIdsAtom,
    visited.includes(id) ? visited.filter((x) => x !== id) : [...visited, id]
  );
});

/** Transient: drives the fetch itself, never persisted. */
export const calculateRequestedAtom = atom(false);

/** Transient: whether the results sheet is on screen. */
export const resultsOpenAtom = atom(false);

export type SelectedPlaceAtom = ExtractAtomValue<
  typeof selectedPlacesAtomsAtom
>[number];

export const startPlaceAtom = atom((get) => {
  const id = get(startIdAtom);
  if (id === undefined) return undefined;
  return get(selectedPlacesAtom).find((p) => p.id === id);
});

export const endPlaceAtom = atom((get) => {
  const id = get(endIdAtom);
  if (id === undefined) return undefined;
  return get(selectedPlacesAtom).find((p) => p.id === id);
});

/**
 * Everything that is neither the start nor the end is an intermediate stop.
 * The optimizer needs at least two of these.
 */
export const intermediateStopsAtom = atom((get) => {
  const startId = get(startIdAtom);
  const endId = get(endIdAtom);

  return get(selectedPlacesAtom).filter(
    (p) => p.id !== startId && p.id !== endId
  );
});

/** Clears the finished route but keeps the stops, so it can be recalculated. */
export const discardRouteAtom = atom(null, (_get, set) => {
  set(savedRouteAtom, null);
  set(calculateRequestedAtom, false);
  set(resultsOpenAtom, false);
  // Progress belongs to the discarded route, not the stop list.
  set(visitedIdsAtom, []);
});

/** Wipes the whole session — used when starting a fresh race sheet. */
export const startNewRouteAtom = atom(null, (_get, set) => {
  set(savedRouteAtom, null);
  set(calculateRequestedAtom, false);
  set(resultsOpenAtom, false);
  set(selectedPlacesAtom, []);
  set(startIdAtom, undefined);
  set(endIdAtom, undefined);
  set(queryAtom, "");
  set(visitedIdsAtom, []);
});
