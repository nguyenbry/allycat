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
      // in the case of nothing, don't debounce it because this should cause UI update as fast as possible
      setDebouncedQuery(undefined);
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedQuery(cleaned2);
    }, 750);

    return () => {
      clearTimeout(timer);
    };
  }, [cleaned2]);

  const searchQuery = useQuery({
    queryKey: ["places-search", debouncedQuery, locationBias],
    queryFn: () => {
      return placesSearch({
        query: debouncedQuery ?? "dummy",
        locationBias: locationBias,
      });
    },
    gcTime: 1000 * 20, // 20 seconds
    enabled: !!debouncedQuery,
    staleTime: Infinity,
  });

  return searchQuery;
}
