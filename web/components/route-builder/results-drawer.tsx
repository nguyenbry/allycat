"use client";

import * as React from "react";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useQuery } from "@tanstack/react-query";
import {
  calculateRequestedAtom,
  discardRouteAtom,
  endPlaceAtom,
  intermediateStopsAtom,
  resultsOpenAtom,
  savedRouteAtom,
  startNewRouteAtom,
  startPlaceAtom,
  toggleVisitedAtom,
  visitedIdsAtom,
  type SavedRoute,
} from "./atoms";
import {
  optimizeRoute,
  routeLegs,
  type OptimizePlace,
  type placeSchema,
  type routeLegSchema,
  type routeSchema,
  type routesPerDestinationSchema,
} from "@/fetcher/fetchers";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import {
  Bike,
  Car,
  Check,
  Flag,
  Navigation,
  RotateCcw,
  Route as RouteIcon,
  Ruler,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import * as R from "remeda";

function toOptimizePlace(place: placeSchema): OptimizePlace {
  return { id: place.id, ...place.location };
}

function hasAtLeastTwo<T>(arr: T[]): arr is [T, T, ...T[]] {
  return arr.length >= 2;
}

export function ResultsDrawer() {
  const [open, setOpen] = useAtom(resultsOpenAtom);
  const [requested, setRequested] = useAtom(calculateRequestedAtom);
  const [savedRoute, setSavedRoute] = useAtom(savedRouteAtom);

  const start = useAtomValue(startPlaceAtom);
  const end = useAtomValue(endPlaceAtom);
  const intermediates = useAtomValue(intermediateStopsAtom);

  const stops = intermediates.map(toOptimizePlace);
  const canCalculate = start !== undefined && hasAtLeastTwo(stops);

  const query = useQuery({
    queryKey: ["optimize", start?.id, end?.id, stops.map((s) => s.id)],
    enabled: requested && canCalculate,
    // Each run fans out one Google request per candidate finish; never refetch
    // on its own, and keep it around so reopening the sheet is instant.
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30,
    queryFn: () => {
      if (!start || !hasAtLeastTwo(stops)) {
        throw new Error("route is not ready to calculate");
      }

      return optimizeRoute({
        origin: toOptimizePlace(start),
        stops,
        destination: end ? toOptimizePlace(end) : undefined,
      });
    },
  });

  // Freeze the result the moment it lands. This is what survives the tab
  // being evicted mid-race.
  const data = query.data;
  React.useEffect(() => {
    if (!data || !start) return;

    setSavedRoute({
      routes: data,
      places: [start, ...intermediates, ...(end ? [end] : [])],
      startId: start.id,
      endId: end?.id,
      calculatedAt: Date.now(),
    });
    setRequested(false);
    // `intermediates`/`end` are only read to snapshot alongside `data`; the
    // arrival of `data` is the real trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Coming back to the app with a route already computed should show it.
  React.useEffect(() => {
    if (savedRoute) setOpen(true);
    // Mount only: later changes are driven by explicit user actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isWorking = requested && (query.isPending || query.isFetching);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent className="max-h-[92dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Your route</DrawerTitle>
          <DrawerDescription>
            <RouteSubtitle savedRoute={savedRoute} isWorking={isWorking} />
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="px-4">
          <ResultsBody
            isWorking={isWorking}
            error={query.isError ? query.error : undefined}
            savedRoute={savedRoute}
          />
        </DrawerBody>

        {savedRoute && (
          <DrawerFooter className="flex-row">
            <DiscardButton />
            <NewRouteButton />
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function RouteSubtitle({
  savedRoute,
  isWorking,
}: {
  savedRoute: SavedRoute | null;
  isWorking: boolean;
}) {
  if (isWorking) return <>Working it out…</>;
  if (!savedRoute) return <>No route yet.</>;

  const end = savedRoute.endId
    ? savedRoute.places.find((p) => p.id === savedRoute.endId)
    : undefined;

  return (
    <>
      {end
        ? `Finishing at ${end.displayName.text}.`
        : "No fixed finish — every stop was tried as the last one."}{" "}
      <RelativeTime at={savedRoute.calculatedAt} />
    </>
  );
}

/** Rendered after mount only, so the server and client can't disagree. */
function RelativeTime({ at }: { at: number }) {
  const [label, setLabel] = React.useState<string | null>(null);

  React.useEffect(() => {
    const update = () => {
      const mins = Math.floor((Date.now() - at) / 60000);
      if (mins < 1) setLabel("just now");
      else if (mins < 60) setLabel(`${mins}m ago`);
      else setLabel(`${Math.floor(mins / 60)}h ago`);
    };

    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [at]);

  if (label === null) return null;
  return <span className="text-muted-foreground">Calculated {label}.</span>;
}

function DiscardButton() {
  const discard = useSetAtom(discardRouteAtom);

  return (
    <Button variant="outline" className="flex-1" onClick={() => discard()}>
      Discard
    </Button>
  );
}

function NewRouteButton() {
  const startNew = useSetAtom(startNewRouteAtom);

  return (
    <Button variant="destructive" className="flex-1" onClick={() => startNew()}>
      <RotateCcw />
      New route
    </Button>
  );
}

export function ResultsBody({
  isWorking,
  error,
  savedRoute,
}: {
  isWorking: boolean;
  error: Error | undefined;
  savedRoute: SavedRoute | null;
}) {
  if (isWorking) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <Spinner className="size-8" />
        <p className="text-muted-foreground text-sm">
          Solving and checking against Google…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlert />
          </EmptyMedia>
          <EmptyTitle>Could not calculate</EmptyTitle>
          <EmptyDescription>{error.message}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (!savedRoute || savedRoute.routes.length === 0) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Flag />
          </EmptyMedia>
          <EmptyTitle>No route yet</EmptyTitle>
          <EmptyDescription>
            Add your stops, then tap Calculate.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const sorted = savedRoute.routes
    .slice()
    .sort((a, b) => (a.bike?.meters ?? Infinity) - (b.bike?.meters ?? Infinity));

  return (
    <div className="flex flex-col gap-3 pb-4">
      {sorted.map((route, i) => (
        // The destination alone is not unique: the solver always finishes at
        // one of the places Google also returns a route for, so keying on it
        // collides and React keeps stale cards from the previous calculation.
        // Method plus destination is unique — at most one of each per finish.
        <DestinationCard
          key={`${route.method ?? "google"}:${route.destination}`}
          route={route}
          rank={i}
          savedRoute={savedRoute}
        />
      ))}
    </div>
  );
}

function DestinationCard({
  route: { destination, bike, car, method },
  rank,
  savedRoute,
}: {
  route: routesPerDestinationSchema;
  rank: number;
  savedRoute: SavedRoute;
}) {
  const destinationPlace = savedRoute.places.find((p) => p.id === destination);

  // Only the solver reports straight-line distance; Google's numbers are
  // already measured on roads.
  const isEstimate = method === "tsp";

  if (!bike && !car) return null;

  // The car order is often identical to the bike order; showing both is noise.
  const carIsDistinct = car && !(bike && R.isDeepEqual(bike.order, car.order));

  return (
    <div
      className={cn(
        "bg-card overflow-hidden rounded-2xl border",
        rank === 0 && "ring-jade-7 border-jade-7 ring-1"
      )}
    >
      <div className="flex items-start gap-3 p-4 pb-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
            rank === 0 ? "bg-jade-9 text-white" : "bg-muted text-muted-foreground"
          )}
        >
          {rank + 1}
        </span>
        <div className="flex min-w-0 grow flex-col">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Finish
          </span>
          <span className="truncate font-semibold">
            {destinationPlace?.displayName.text ?? "Unknown place"}
          </span>
          <span className="text-muted-foreground truncate text-sm">
            {destinationPlace?.formattedAddress}
          </span>
        </div>
        {method === "tsp" && (
          <Badge variant="outline" className="shrink-0 gap-1">
            <Sparkles className="size-3" />
            Solver
          </Badge>
        )}
      </div>

      {bike && carIsDistinct ? (
        <Tabs defaultValue="bike" className="px-4 pb-4">
          <TabsList className="w-full">
            <TabsTrigger value="bike" className="flex-1">
              <Bike className="size-4" />
              Bike
            </TabsTrigger>
            <TabsTrigger value="car" className="flex-1">
              <Car className="size-4" />
              Car
            </TabsTrigger>
          </TabsList>
          <TabsContent value="bike">
            <RouteLegs
              route={bike}
              destination={destination}
              savedRoute={savedRoute}
              isEstimate={isEstimate}
              byCar={false}
            />
          </TabsContent>
          <TabsContent value="car">
            <RouteLegs
              route={car}
              destination={destination}
              savedRoute={savedRoute}
              isEstimate={isEstimate}
              byCar
            />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="px-4 pb-4">
          {bike ? (
            <RouteLegs
              route={bike}
              destination={destination}
              savedRoute={savedRoute}
              isEstimate={isEstimate}
              byCar={false}
            />
          ) : (
            car && (
              <RouteLegs
                route={car}
                destination={destination}
                savedRoute={savedRoute}
                isEstimate={isEstimate}
                byCar
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Fetches the real road distance of each hop for an order that is already
 * decided.
 *
 * Deliberately additive: the route is already on screen and usable before this
 * resolves, and a failure only removes the per-hop numbers. Nothing here may
 * block or replace the route itself — mid-race, some answer beats a better one
 * that never arrives.
 */
function useRealLegs({
  route,
  destination,
  savedRoute,
  byCar,
}: {
  route: routeSchema;
  destination: string;
  savedRoute: SavedRoute;
  byCar: boolean;
}) {
  return useQuery({
    queryKey: [
      "route-legs",
      savedRoute.startId,
      route.order,
      destination,
      byCar,
    ],
    // Measuring a fixed order never changes; don't pay for it twice.
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30,
    retry: 1,
    queryFn: () =>
      routeLegs({
        origin: savedRoute.startId,
        stops: route.order,
        destination,
        byCar,
      }),
  });
}

function RouteLegs({
  route,
  destination,
  savedRoute,
  isEstimate,
  byCar,
}: {
  route: routeSchema;
  destination: string;
  savedRoute: SavedRoute;
  isEstimate: boolean;
  byCar: boolean;
}) {
  const lookup = (id: string) => savedRoute.places.find((p) => p.id === id);

  const real = useRealLegs({ route, destination, savedRoute, byCar });

  // fromId -> that hop, so each row can show the distance to the next stop.
  const legByFrom = new Map(
    (real.data?.legs ?? []).map((leg) => [leg.fromId, leg])
  );

  // Summed from the same legs shown per row, so the total and the hops can
  // never disagree with each other.
  const measuredMiles = real.data
    ? real.data.legs.reduce((sum, leg) => sum + leg.meters, 0) / 1609.344
    : undefined;

  const ordered = [savedRoute.startId, ...route.order, destination];

  return (
    <div className="flex flex-col gap-3 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{route.displayDistance}</Badge>
        {/* The solver has no duration model, so it sends a placeholder. */}
        {route.displayDuration !== "idk2" && (
          <Badge variant="secondary">{route.displayDuration}</Badge>
        )}
        {isEstimate && (
          <Badge variant="outline" className="gap-1">
            <Ruler className="size-3" />
            Estimated
          </Badge>
        )}
        {/* Sits next to the estimate so both numbers are readable in one
            glance, which is the whole point mid-race. */}
        {isEstimate && measuredMiles !== undefined && (
          <Badge variant="jade" className="gap-1">
            <RouteIcon className="size-3" />
            {measuredMiles.toFixed(1)} mi actual
          </Badge>
        )}
      </div>

      {isEstimate && (
        <p className="text-muted-foreground text-xs leading-relaxed">
          Straight-line distance between stops, padded by 10% — it ignores
          roads, one-ways and river crossings, so the real ride is longer.
          {real.data && <> On roads it&apos;s about {real.data.displayDuration}.</>}
        </p>
      )}

      {real.isError && (
        <p className="text-muted-foreground text-xs">
          Couldn&apos;t measure the real distances — showing the estimate only.
        </p>
      )}

      <ol className="flex flex-col">
        {ordered.map((placeId, i) => {
          const place = lookup(placeId);
          if (!place) return null;

          const isStart = i === 0;
          const isEnd = i === ordered.length - 1;

          return (
            <LegRow
              key={`${placeId}:${i}`}
              place={place}
              label={isStart || isEnd ? "" : `${i}`}
              tone={isStart ? "start" : isEnd ? "end" : "stop"}
              toNext={legByFrom.get(placeId)}
              isMeasuring={real.isPending}
            />
          );
        })}
      </ol>
    </div>
  );
}

function LegRow({
  place,
  label,
  tone,
  toNext,
  isMeasuring,
}: {
  place: placeSchema;
  label: string;
  tone: "start" | "stop" | "end";
  toNext: routeLegSchema | undefined;
  isMeasuring: boolean;
}) {
  const visited = useAtomValue(visitedIdsAtom);
  const toggleVisited = useSetAtom(toggleVisitedAtom);

  const isVisited = visited.includes(place.id);

  return (
    <li className="flex items-center gap-3 border-b py-2 last:border-b-0">
      {/* The marker doubles as the tick-off control: a big, obvious target
          that works with one thumb while moving. */}
      <button
        type="button"
        onClick={() => toggleVisited(place.id)}
        aria-pressed={isVisited}
        aria-label={
          isVisited
            ? `Mark ${place.displayName.text} as not visited`
            : `Mark ${place.displayName.text} as visited`
        }
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors active:scale-95",
          isVisited
            ? "bg-jade-9 text-white"
            : tone === "start"
              ? "bg-jade-3 text-jade-11 ring-jade-7 ring-1"
              : tone === "end"
                ? "bg-destructive/15 text-destructive ring-destructive/40 ring-1"
                : "bg-muted text-muted-foreground"
        )}
      >
        {isVisited ? (
          <Check className="size-5" />
        ) : tone === "stop" ? (
          label
        ) : (
          <Flag className="size-4" />
        )}
      </button>

      <div className="flex min-w-0 grow flex-col">
        <span
          className={cn(
            "truncate text-sm font-medium",
            isVisited && "text-muted-foreground line-through"
          )}
        >
          {place.displayName.text}
        </span>
        <span className="text-muted-foreground truncate text-xs">
          {place.formattedAddress}
        </span>
        {tone !== "end" && (
          <span className="text-muted-foreground mt-0.5 text-xs">
            {toNext ? (
              <>
                ↓ {toNext.displayDistance} · {toNext.displayDuration}
              </>
            ) : isMeasuring ? (
              <span className="opacity-60">↓ measuring…</span>
            ) : null}
          </span>
        )}
      </div>

      <a
        href={place.googleMapsLinks.directionsUri}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Directions to ${place.displayName.text}`}
        className={cn(
          buttonVariants({ size: "icon", variant: "outline" }),
          "shrink-0"
        )}
      >
        <Navigation className="size-4" />
      </a>
    </li>
  );
}
