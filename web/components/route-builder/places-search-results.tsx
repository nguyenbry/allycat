"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { baseLocationAtom, selectedPlacesAtom, startIdAtom } from "./atoms";
import { usePlacesQueryForThisPage } from "./hooks";
import { type placeSchema } from "@/fetcher/fetchers";
import { cn } from "@/lib/utils";
import { Check, MapPin, Plus, Search, SearchX, TriangleAlert } from "lucide-react";
import { motion } from "motion/react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

function PlaceResultRow({ place }: { place: placeSchema }) {
  const [selectedPlaces, setSelectedPlaces] = useAtom(selectedPlacesAtom);
  const setStart = useSetAtom(startIdAtom);

  const isSelected = selectedPlaces.some((x) => x.id === place.id);

  const toggle = () => {
    if (isSelected) {
      setSelectedPlaces(selectedPlaces.filter((x) => x.id !== place.id));
      setStart((id) => (id === place.id ? undefined : id));
      return;
    }

    setSelectedPlaces([...selectedPlaces, place]);

    // The first place added is almost always wherever the rider is standing,
    // so make it the start until told otherwise.
    if (selectedPlaces.length === 0) {
      setStart(place.id);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isSelected}
      className={cn(
        // Tall rows: this gets tapped with one thumb, often in a hurry.
        "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors active:scale-[0.99]",
        isSelected
          ? "border-jade-7 bg-jade-3"
          : "bg-card hover:bg-accent border-border"
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors",
          isSelected
            ? "bg-jade-9 text-white"
            : "bg-muted text-muted-foreground"
        )}
      >
        {isSelected ? (
          <Check className="size-5" />
        ) : (
          <Plus className="size-5" />
        )}
      </span>

      <span className="flex min-w-0 flex-col">
        <span
          className={cn(
            "truncate font-semibold",
            isSelected && "text-jade-12"
          )}
        >
          {place.displayName.text}
        </span>
        <span className="text-muted-foreground truncate text-sm">
          {place.formattedAddress}
        </span>
      </span>
    </button>
  );
}

export function PlacesSearchResults() {
  const placesQuery = usePlacesQueryForThisPage();
  const baseLocation = useAtomValue(baseLocationAtom);

  if (placesQuery.isFetching && !placesQuery.data) {
    return (
      <div className="flex flex-col gap-2 py-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border p-3">
            <Skeleton className="size-10 shrink-0 rounded-lg" />
            <div className="flex w-full flex-col gap-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (placesQuery.isError) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlert />
          </EmptyMedia>
          <EmptyTitle>Search failed</EmptyTitle>
          <EmptyDescription>{placesQuery.error.message}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (!placesQuery.data) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Search />
          </EmptyMedia>
          <EmptyTitle>Search for a stop</EmptyTitle>
          <EmptyDescription>
            {baseLocation
              ? `Results will be biased near ${baseLocation.displayName.text}.`
              : "Set a base location first so bare street addresses resolve to the right city."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (placesQuery.data.length === 0) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX />
          </EmptyMedia>
          <EmptyTitle>No results</EmptyTitle>
          <EmptyDescription>
            {baseLocation ? (
              <>
                Nothing found near {baseLocation.displayName.text}. Try a
                different base location.
              </>
            ) : (
              <>
                Try setting a base location — it anchors searches to one city.
              </>
            )}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-2 py-2">
      {baseLocation && (
        <p className="text-muted-foreground flex items-center gap-1.5 px-1 text-xs">
          <MapPin className="size-3 shrink-0" />
          near {baseLocation.displayName.text}
        </p>
      )}
      {placesQuery.data.map((place, i) => (
        <motion.div
          key={place.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i * 0.03, 0.2) }}
        >
          <PlaceResultRow place={place} />
        </motion.div>
      ))}
    </div>
  );
}
