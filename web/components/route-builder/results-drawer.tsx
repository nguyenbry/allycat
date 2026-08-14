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
  type SavedRoute,
} from "./atoms";
import {
  optimizeRoute,
  type OptimizePlace,
  type placeSchema,
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
  Flag,
  Navigation,
  RotateCcw,
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
            />
          </TabsContent>
          <TabsContent value="car">
            <RouteLegs
              route={car}
              destination={destination}
              savedRoute={savedRoute}
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
            />
          ) : (
            car && (
              <RouteLegs
                route={car}
                destination={destination}
                savedRoute={savedRoute}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

function RouteLegs({
  route,
  destination,
  savedRoute,
}: {
  route: routeSchema;
  destination: string;
  savedRoute: SavedRoute;
}) {
  const lookup = (id: string) => savedRoute.places.find((p) => p.id === id);
  const start = lookup(savedRoute.startId);

  return (
    <div className="flex flex-col gap-3 pt-3">
      <div className="flex gap-2">
        <Badge variant="secondary">{route.displayDistance}</Badge>
        {/* The solver has no duration model, so it sends a placeholder. */}
        {route.displayDuration !== "idk2" && (
          <Badge variant="secondary">{route.displayDuration}</Badge>
        )}
      </div>

      <ol className="flex flex-col">
        {start && <LegRow place={start} label="Start" tone="start" />}
        {route.order.map((placeId, i) => {
          const place = lookup(placeId);
          if (!place) return null;
          return (
            <LegRow key={placeId} place={place} label={`${i + 1}`} tone="stop" />
          );
        })}
        {(() => {
          const place = lookup(destination);
          if (!place) return null;
          return <LegRow place={place} label="Finish" tone="end" />;
        })()}
      </ol>
    </div>
  );
}

function LegRow({
  place,
  label,
  tone,
}: {
  place: placeSchema;
  label: string;
  tone: "start" | "stop" | "end";
}) {
  return (
    <li className="flex items-center gap-3 border-b py-2.5 last:border-b-0">
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          tone === "start" && "bg-jade-9 text-white",
          tone === "end" && "bg-destructive text-white",
          tone === "stop" && "bg-muted text-muted-foreground"
        )}
      >
        {tone === "stop" ? label : <Flag className="size-3.5" />}
      </span>

      <div className="flex min-w-0 grow flex-col">
        <span className="truncate text-sm font-medium">
          {place.displayName.text}
        </span>
        <span className="text-muted-foreground truncate text-xs">
          {place.formattedAddress}
        </span>
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
