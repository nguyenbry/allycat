"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { placesSearch } from "@/fetcher/fetchers";

export function usePlacesQuery(
  query: string,
  locationBias: { latitude: number; longitude: number } | undefined
) {
  const cleaned = query.trim() || undefined;

  const cleaned2 = cleaned && cleaned.length > 3 ? cleaned : undefined;

  const [debouncedQuery, setDebouncedQuery] = useState(cleaned2);

  useEffect(() => {
    if (!cleaned2) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setDebouncedQuery(cleaned2);
    }, 750);

    return () => {
      clearTimeout(timer);
    };
  }, [cleaned2]);

  // Clearing the box drops results immediately rather than waiting out the
  // debounce. Derived during render instead of set from the effect, which
  // would cost an extra render pass on every keystroke that empties the box.
  const effectiveQuery = cleaned2 ? debouncedQuery : undefined;

  const searchQuery = useQuery({
    queryKey: ["places-search", effectiveQuery, locationBias],
    queryFn: () => {
      return placesSearch({
        query: effectiveQuery ?? "dummy",
        locationBias: locationBias,
      });
    },
    gcTime: 1000 * 20, // 20 seconds
    enabled: !!effectiveQuery,
    staleTime: Infinity,
  });

  return searchQuery;
}
