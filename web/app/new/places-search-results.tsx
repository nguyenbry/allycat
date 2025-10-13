import { useAtom, useSetAtom } from "jotai";
import { selectedPlacesAtom, startIdAtom } from "./atoms";
import { usePlacesQueryForThisPage } from "./hooks";
import { Button } from "@/components/ui/button";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { type placeSchema } from "@/fetcher/fetchers";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";

function PlaceResult({ place }: { place: placeSchema }) {
  const [selectedPlaces, setSelectedPlaces] = useAtom(selectedPlacesAtom);

  const isSelected = selectedPlaces.some((x) => x.id === place.id);

  const setStart = useSetAtom(startIdAtom);

  return (
    <div className="flex items-center p-2">
      <div className="inline-flex flex-col gap-0.5">
        <span className="text-sm">{place.displayName.text}</span>
        <span className="text-muted-foreground text-xs">
          {place.formattedAddress}
        </span>
      </div>
      <div className="ml-auto inline-flex shrink-0">
        <div className="group relative inline-flex">
          <Button
            className="aria-selected:hover:text-red-11 aria-selected:hover:bg-red-3 aria-selected:hover:focus-visible:ring-red-3/20 aria-selected:hover:border-red-7 rounded-full"
            aria-selected={isSelected}
            size={"icon-sm"}
            variant={isSelected ? "jade" : "outline"}
            onClick={() => {
              if (isSelected) {
                setSelectedPlaces(
                  selectedPlaces.filter((x) => x.id !== place.id)
                );
              } else {
                setSelectedPlaces([...selectedPlaces, place]);

                if (selectedPlaces.length === 0) {
                  setStart(place.id);
                }
              }
            }}
          >
            <Check
              className={cn(
                "absolute shrink-0 transition-all",
                isSelected
                  ? "scale-100 rotate-0 group-hover:scale-0 group-hover:-rotate-90"
                  : "scale-0 rotate-0"
              )}
            />
            <X
              className={cn(
                "shrink-0 scale-0 -rotate-90 transition-all",
                isSelected && "group-hover:scale-100 group-hover:rotate-0"
              )}
            />
            <Plus
              className={cn(
                "absolute shrink-0 transition-all",
                isSelected ? "scale-0 rotate-90" : "scale-100 rotate-0"
              )}
            />
          </Button>
          <AnimatedAddedIndicator show={isSelected} />
        </div>
      </div>
    </div>
  );
}

/**
 * This isn't actually usePrevious because it would
 * return undefined on the first go. But I need this
 * behavior for what I'm doing.
 *
 * Specifically, I want to only render the animation
 * and badge when the value changes. This solves the problem
 * of "on-mount, the show is true". I basically want to
 * skip the animation on the first render, regardless of
 * what the "show" boolean is.
 *
 * And so, if I used the true usePrevious, then on the
 * first render, prev would be undefined, and if show
 * was true, then the animation would run. I don't want
 * that.
 */
function useNotReallyPrevious<T>(value: T) {
  const ref = useRef<T>(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

function useIsDifferentFromLast<T>(curr: T, isEqual: (a: T, b: T) => boolean) {
  const prev = useNotReallyPrevious(curr);

  // if i actually used real usePrevious, then this would be true
  // on the first render, which I don't want.
  return !isEqual(curr, prev);
}

function AnimatedAddedIndicator({ show }: { show: boolean }) {
  const [isVisible, setIsVisible] = useState(show);
  const animationAllowed = useIsDifferentFromLast(isVisible, (a, b) => a === b);

  useEffect(() => {
    setIsVisible(show);

    if (show) {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 1000);
      return () => {
        clearTimeout(timer);
      };
    } else {
      return undefined;
    }
  }, [show]);

  return (
    <AnimatePresence>
      {animationAllowed && isVisible && (
        <motion.div
          initial={{ y: 30, opacity: 0, scale: 0.7 }}
          animate={{
            y: 0,
            opacity: 1,
            scale: 1,
          }}
          exit={{
            opacity: 0,
            scale: 0.8,
            transition: { duration: 0.2 },
          }}
          transition={{
            type: "spring",
            stiffness: 500,
            damping: 30,
            mass: 1,
          }}
          className="absolute top-1/2 right-[110%] -translate-y-1/2"
        >
          <Badge variant={"jade"}>
            <Check className="size-4" /> Added
          </Badge>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function PlacesSearchResults() {
  const placesQuery = usePlacesQueryForThisPage();

  const noResults = (
    <div className="my-auto flex flex-col items-center gap-0.5">
      <p className="text-muted-foreground text-center text-xl font-medium text-balance">
        No results
      </p>
      <p className="text-muted-foreground text-center text-sm text-balance">
        Search for a place to get started
      </p>
    </div>
  );

  if (placesQuery.isPending) {
    return placesQuery.isFetching ? <span>Loading...</span> : noResults;
  }

  if (placesQuery.isError) {
    return <span>Error</span>;
  }
  if (placesQuery.data.length === 0) {
    return noResults;
  }

  return (
    <div className="divide-border my-4 flex flex-col divide-y">
      {placesQuery.data.map((place) => (
        <PlaceResult key={place.id} place={place} />
      ))}
    </div>
  );
}
