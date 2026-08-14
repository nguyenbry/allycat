"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { useMediaQuery } from "@/components/hooks/use-media-query";
import { usePlacesQuery } from "@/components/places-search/places-search-test";
import { type placeSchema } from "@/fetcher/fetchers";
import { Search, SearchX, TriangleAlert } from "lucide-react";

type PlaceSearchDialogProps = React.PropsWithChildren<{
  title: string;
  description: string;
  onSelect: (place: placeSchema) => void;
  locationBias: { longitude: number; latitude: number } | undefined;
  /**
   * Keep the dialog open and refocus the input after a pick, so a whole race
   * sheet can be entered without reopening between every address.
   */
  keepOpen?: boolean;
}>;

export function PlaceSearchDialog({
  children,
  title,
  description,
  onSelect,
  locationBias,
  keepOpen,
}: PlaceSearchDialogProps) {
  const [open, setOpen] = React.useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const body = (
    <PlaceSearchBody
      locationBias={locationBias}
      keepOpen={keepOpen}
      onSelect={onSelect}
      onDone={() => setOpen(false)}
      // Remount on every open so the previous query never lingers.
      key={open ? "open" : "closed"}
    />
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        {/* Bounded height and a flex column so the result list below has
            something definite to shrink against. */}
        <DialogContent className="flex max-h-[80dvh] flex-col sm:max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent className="h-[92dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <div className="flex min-h-0 grow flex-col px-4 pb-4">
          {body}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function PlaceSearchBody({
  locationBias,
  keepOpen,
  onSelect,
  onDone,
}: {
  locationBias: { longitude: number; latitude: number } | undefined;
  keepOpen?: boolean;
  onSelect: (place: placeSchema) => void;
  onDone: () => void;
}) {
  const [value, setValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const placesQuery = usePlacesQuery(value, locationBias);

  const handleSelect = (place: placeSchema) => {
    onSelect(place);

    if (keepOpen) {
      setValue("");
      inputRef.current?.focus();
    } else {
      onDone();
    }
  };

  return (
    <div className="flex min-h-0 grow flex-col gap-3">
      <InputGroup>
        <InputGroupInput
          ref={inputRef}
          autoFocus
          placeholder="Search for a place"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        {placesQuery.isFetching && (
          <InputGroupAddon align="inline-end">
            <Spinner />
          </InputGroupAddon>
        )}
      </InputGroup>

      <PlaceSearchResultList
        query={placesQuery}
        value={value}
        onSelect={handleSelect}
      />
    </div>
  );
}

function PlaceSearchResultList({
  query,
  value,
  onSelect,
}: {
  query: ReturnType<typeof usePlacesQuery>;
  value: string;
  onSelect: (place: placeSchema) => void;
}) {
  if (query.isError) {
    return (
      <Empty className="min-h-[30dvh]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlert />
          </EmptyMedia>
          <EmptyTitle>Search failed</EmptyTitle>
          <EmptyDescription>{query.error.message}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (!query.data) {
    return (
      <Empty className="min-h-[30dvh]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Search />
          </EmptyMedia>
          <EmptyTitle>Start typing</EmptyTitle>
          <EmptyDescription>
            Enter at least 4 characters to search.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (query.data.length === 0) {
    return (
      <Empty className="min-h-[30dvh]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX />
          </EmptyMedia>
          <EmptyTitle>No results</EmptyTitle>
          <EmptyDescription>
            Nothing matched &quot;{value}&quot;. Try adding a city, or set a base
            location first.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    // Native scrolling with vaul drag disabled — inside a drawer a ScrollArea
    // viewport does not become the overflowing box, so the list will not
    // scroll on touch. See DrawerBody.
    <div
      data-vaul-no-drag=""
      className="min-h-0 grow overflow-y-auto overscroll-contain"
    >
      <div className="flex flex-col gap-1 pr-1 pb-2">
        {query.data.map((place) => (
          <Item
            key={place.id}
            asChild
            variant="outline"
            size="sm"
            className="cursor-pointer text-left"
          >
            <button type="button" onClick={() => onSelect(place)}>
              <ItemContent>
                <ItemTitle>{place.displayName.text}</ItemTitle>
                <ItemDescription>{place.formattedAddress}</ItemDescription>
              </ItemContent>
            </button>
          </Item>
        ))}
      </div>
    </div>
  );
}
