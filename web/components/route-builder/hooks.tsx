import { useAtomValue } from "jotai";
import { baseLocationAtom, queryAtom } from "./atoms";
import { usePlacesQuery } from "@/components/places-search/places-search-test";

/**
 * The main search box. Biased by the base location when one is set, which is
 * what makes a bare street address off a race sheet resolve to the right city.
 */
export function usePlacesQueryForThisPage() {
  const query = useAtomValue(queryAtom);
  const baseLocation = useAtomValue(baseLocationAtom);

  return usePlacesQuery(query, baseLocation?.location);
}
