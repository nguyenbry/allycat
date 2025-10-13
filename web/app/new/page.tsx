"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { useAtom, useAtomValue } from "jotai";
import { Loader2, Search, TriangleAlert } from "lucide-react";
import { endIdAtom, queryAtom, selectedPlacesAtom, startIdAtom } from "./atoms";
import { usePlacesQueryForThisPage } from "./hooks";
import { PlacesSearchResults } from "./places-search-results";
import { Sidebar } from "./sidebar";
import { Badge } from "@/components/ui/badge";
import { useMemo } from "use-memo-one";
import { focusAtom } from "jotai-optics";

export default function NewPage() {
  return (
    <div className="flex min-h-screen w-screen">
      <Sidebar />
      <div className="flex grow flex-col p-8">
        <div className="sticky top-8 z-[100] flex flex-col gap-2">
          <SearchBar />
          <InfoBar />
        </div>

        <PlacesSearchResults />
        {/* <List /> */}
      </div>
    </div>
  );
}

function InfoBar() {
  const [selectedPlaces] = useAtom(selectedPlacesAtom);

  const startId = useAtomValue(startIdAtom);
  const endId = useAtomValue(endIdAtom);

  const startName = useAtomValue(
    useMemo(
      () =>
        focusAtom(selectedPlacesAtom, (x) =>
          x
            .find((p) => p.id === startId)
            .pick(["displayName", "formattedAddress"])
        ),
      [startId]
    )
  );

  const endName = useAtomValue(
    useMemo(
      () =>
        focusAtom(selectedPlacesAtom, (x) =>
          x
            .find((p) => p.id === endId)
            .pick(["displayName", "formattedAddress"])
        ),
      [endId]
    )
  );

  return (
    <div className="flex gap-1">
      {selectedPlaces.length > 0 && (
        <Badge variant={"secondary"}>{selectedPlaces.length} locations</Badge>
      )}
      {startName !== undefined && (
        <Badge variant={"jade"}>
          Start: {startName.displayName.text} ({startName.formattedAddress})
        </Badge>
      )}
      {endName !== undefined && (
        <Badge variant={"destructive"}>
          End: {endName.displayName.text} ({endName.formattedAddress})
        </Badge>
      )}
    </div>
  );
}

function SearchBar() {
  const placesQuery = usePlacesQueryForThisPage();

  const [query, setQuery] = useAtom(queryAtom);

  return (
    <InputGroup className="backdrop-blur-xl">
      <InputGroupInput
        placeholder="Search for a place"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupAddon align="inline-end">
        {placesQuery.isPending ? (
          placesQuery.isFetching ? (
            <Loader2 className="animate-spin" />
          ) : // nothing is happening with the query
          null
        ) : placesQuery.isError ? (
          <TriangleAlert className="text-destructive" />
        ) : placesQuery.data.length === 0 ? (
          "no results"
        ) : (
          `${placesQuery.data.length} results`
        )}
      </InputGroupAddon>
    </InputGroup>
  );
}

// function Main() {}

// function List() {
//   return (
//     <>
//       {Array.from({ length: 2000 }).map((_, i) => {
//         return <div>{i}</div>;
//       })}
//     </>
//   );
// }
