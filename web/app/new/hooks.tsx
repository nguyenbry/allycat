import { useAtomValue } from "jotai";
import { queryAtom } from "./atoms";
import { usePlacesQuery } from "@/components/places-search/places-search-test";

export function usePlacesQueryForThisPage() {
  const query = useAtomValue(queryAtom);
  return usePlacesQuery(query, undefined);
}
