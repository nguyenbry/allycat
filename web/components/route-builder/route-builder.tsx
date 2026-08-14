"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  baseLocationAtom,
  intermediateStopsAtom,
  queryAtom,
  resultsOpenAtom,
  savedRouteAtom,
  selectedPlacesAtom,
  startPlaceAtom,
} from "./atoms";
import { usePlacesQueryForThisPage } from "./hooks";
import { PlacesSearchResults } from "./places-search-results";
import { PlaceSearchDialog } from "./place-search-dialog";
import { PasswordGate } from "./password-gate";
import { RouteDrawer } from "./route-drawer";
import { ResultsDrawer } from "./results-drawer";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  ListChecks,
  MapPinned,
  Route as RouteIcon,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";

export function RouteBuilderPage() {
  return (
    <PasswordGate>
      <RouteBuilder />
    </PasswordGate>
  );
}

function RouteBuilder() {
  return (
    // Mobile-first: one column, capped on larger screens rather than
    // spreading into a desktop-only sidebar layout.
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col">
      <header className="bg-background/80 sticky top-0 z-30 flex flex-col gap-3 border-b px-4 pt-4 pb-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">allycat</h1>
          <ThemeToggle className="ml-auto" />
        </div>

        <BaseLocationControl />
        <SearchBar />
      </header>

      <main className="grow px-4 pb-32">
        <PlacesSearchResults />
      </main>

      <BottomBar />
      <ResultsDrawer />
    </div>
  );
}

/**
 * The base location anchors every search to one city. Prominent and early in
 * the flow because setting it first is what makes bare street addresses off a
 * race sheet resolve correctly.
 */
function BaseLocationControl() {
  const [baseLocation, setBaseLocation] = useAtom(baseLocationAtom);

  if (!baseLocation) {
    return (
      <PlaceSearchDialog
        title="Set base location"
        description="Pick an anchor near the race — city hall works well. Every later search is biased toward it."
        locationBias={undefined}
        onSelect={setBaseLocation}
      >
        <Button variant="outline" size="sm" className="w-full justify-start">
          <MapPinned />
          Set base location
          <Badge variant="secondary" className="ml-auto">
            optional
          </Badge>
        </Button>
      </PlaceSearchDialog>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <PlaceSearchDialog
        title="Change base location"
        description="Pick an anchor near the race — city hall works well. Every later search is biased toward it."
        locationBias={baseLocation.location}
        onSelect={setBaseLocation}
      >
        <Button
          variant="outline"
          size="sm"
          className="border-jade-7 bg-jade-3 text-jade-12 hover:bg-jade-4 min-w-0 grow justify-start"
        >
          <MapPinned className="text-jade-11" />
          <span className="truncate">{baseLocation.displayName.text}</span>
        </Button>
      </PlaceSearchDialog>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Clear base location"
        onClick={() => setBaseLocation(undefined)}
      >
        <X />
      </Button>
    </div>
  );
}

function SearchBar() {
  const placesQuery = usePlacesQueryForThisPage();
  const [query, setQuery] = useAtom(queryAtom);

  return (
    <InputGroup>
      <InputGroupInput
        placeholder="Search an address from the sheet"
        inputMode="search"
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupAddon align="inline-end">
        {placesQuery.isFetching ? (
          <Spinner />
        ) : placesQuery.isError ? (
          <TriangleAlert className="text-destructive" />
        ) : query.length > 0 ? (
          <InputGroupButton
            size="icon-xs"
            variant="ghost"
            aria-label="Clear search"
            onClick={() => setQuery("")}
          >
            <X />
          </InputGroupButton>
        ) : null}
      </InputGroupAddon>
    </InputGroup>
  );
}

/**
 * Fixed to the bottom so the two actions that matter mid-race stay under a
 * thumb, clear of the browser chrome via safe-area padding.
 */
function BottomBar() {
  const selectedPlaces = useAtomValue(selectedPlacesAtom);
  const start = useAtomValue(startPlaceAtom);
  const intermediates = useAtomValue(intermediateStopsAtom);
  const savedRoute = useAtomValue(savedRouteAtom);
  const setResultsOpen = useSetAtom(resultsOpenAtom);

  const ready = start !== undefined && intermediates.length >= 2;

  return (
    <div className="bg-background/85 fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <RouteDrawer>
          <Button
            variant={savedRoute ? "outline" : ready ? "default" : "outline"}
            size="lg"
            className="grow justify-between"
          >
            <span className="flex items-center gap-2">
              <ListChecks />
              Stops
            </span>
            <Badge variant="secondary">{selectedPlaces.length}</Badge>
          </Button>
        </RouteDrawer>

        {savedRoute && (
          <Button
            size="lg"
            className="grow"
            onClick={() => setResultsOpen(true)}
          >
            <RouteIcon />
            View route
          </Button>
        )}
      </div>
    </div>
  );
}
