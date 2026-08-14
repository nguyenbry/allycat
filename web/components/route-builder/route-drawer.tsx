"use client";

import * as React from "react";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  baseLocationAtom,
  calculateRequestedAtom,
  endIdAtom,
  intermediateStopsAtom,
  resultsOpenAtom,
  selectedPlacesAtom,
  startIdAtom,
  startPlaceAtom,
} from "./atoms";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Flag,
  MapPinned,
  MoreVertical,
  Route as RouteIcon,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type placeSchema } from "@/fetcher/fetchers";

export function RouteDrawer({ children }: React.PropsWithChildren) {
  const [open, setOpen] = React.useState(false);

  const selectedPlaces = useAtomValue(selectedPlacesAtom);
  const start = useAtomValue(startPlaceAtom);
  const intermediates = useAtomValue(intermediateStopsAtom);
  const setCalculateRequested = useSetAtom(calculateRequestedAtom);
  const setResultsOpen = useSetAtom(resultsOpenAtom);

  const problem = describeProblem({
    hasStart: start !== undefined,
    intermediateCount: intermediates.length,
  });

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent className="max-h-[88dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Your route</DrawerTitle>
          <DrawerDescription>
            {selectedPlaces.length} location
            {selectedPlaces.length === 1 ? "" : "s"} added. The optimizer picks
            the order — you only choose where it starts and, if you want, where
            it ends.
          </DrawerDescription>
        </DrawerHeader>

        <ScrollArea className="min-h-0 grow px-4">
          {selectedPlaces.length === 0 ? (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MapPinned />
                </EmptyMedia>
                <EmptyTitle>No locations yet</EmptyTitle>
                <EmptyDescription>
                  Search above and tap a result to add it.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="flex flex-col gap-2 pb-4">
              <AnimatePresence initial={false}>
                {selectedPlaces.map((place) => (
                  <RouteStopRow key={place.id} place={place} />
                ))}
              </AnimatePresence>
            </ul>
          )}
        </ScrollArea>

        <DrawerFooter>
          {problem && (
            <p className="text-muted-foreground text-center text-xs">
              {problem}
            </p>
          )}
          <DrawerClose asChild>
            <Button
              size="lg"
              disabled={problem !== undefined}
              onClick={() => {
                setCalculateRequested(true);
                setResultsOpen(true);
              }}
            >
              <RouteIcon />
              Calculate route
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

/**
 * The server needs an origin plus at least two intermediate stops, so say
 * which of those is missing rather than just disabling the button.
 */
function describeProblem({
  hasStart,
  intermediateCount,
}: {
  hasStart: boolean;
  intermediateCount: number;
}): string | undefined {
  if (!hasStart) return "Pick a start location to continue.";

  if (intermediateCount < 2) {
    const needed = 2 - intermediateCount;
    return `Add ${needed} more stop${needed === 1 ? "" : "s"} between the start and the end.`;
  }

  return undefined;
}

function RouteStopRow({ place }: { place: placeSchema }) {
  const [startId, setStartId] = useAtom(startIdAtom);
  const [endId, setEndId] = useAtom(endIdAtom);
  const [baseLocation, setBaseLocation] = useAtom(baseLocationAtom);
  const setSelectedPlaces = useSetAtom(selectedPlacesAtom);

  const isStart = startId === place.id;
  const isEnd = endId === place.id;
  const isBase = baseLocation?.id === place.id;

  const remove = () => {
    setSelectedPlaces((places) => places.filter((x) => x.id !== place.id));
    setStartId((id) => (id === place.id ? undefined : id));
    setEndId((id) => (id === place.id ? undefined : id));
  };

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 500, damping: 34 }}
      className="bg-card flex items-center gap-3 rounded-xl border p-3"
    >
      <div className="flex min-w-0 grow flex-col gap-1">
        <span className="truncate font-medium">{place.displayName.text}</span>
        <span className="text-muted-foreground truncate text-sm">
          {place.formattedAddress}
        </span>
        {(isStart || isEnd || isBase) && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {isStart && <Badge variant="jade">Start</Badge>}
            {isEnd && <Badge variant="destructive">End</Badge>}
            {isBase && <Badge variant="outline">Base</Badge>}
          </div>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Options for ${place.displayName.text}`}
            className="shrink-0"
          >
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuItem
              onSelect={() =>
                setStartId(isStart ? undefined : place.id)
              }
            >
              <Flag />
              {isStart ? "Clear start" : "Set as start"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => setEndId(isEnd ? undefined : place.id)}
            >
              <Flag />
              {isEnd ? "Clear end" : "Set as end"}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              onSelect={() => setBaseLocation(isBase ? undefined : place)}
            >
              <MapPinned />
              {isBase ? "Clear base location" : "Use as base location"}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={remove}>
            <Trash2 />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.li>
  );
}
