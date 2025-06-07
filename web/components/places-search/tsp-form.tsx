"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { useMediaQuery } from "../hooks/use-media-query";
import { Button, buttonVariants } from "@/components/ui/button";
import { focusAtom } from "jotai-optics";
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
import { Input } from "@/components/ui/input";
import {
  optimizeRoute,
  type routeSchema,
  type routesPerDestinationSchema,
  type placeSchema,
} from "@/fetcher/fetchers";
import {
  atom,
  type createStore,
  type ExtractAtomValue,
  type PrimitiveAtom,
  Provider,
  useAtom,
  useAtomValue,
  useSetAtom,
  useStore,
} from "jotai";
import { usePlacesQuery } from "./places-search-test";
import { Bike, Car, Loader2, Map, Pencil, Plus, Trash2 } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { type PropsWithCn } from "../types";
import { useMemo } from "use-memo-one";
import { useQuery } from "@tanstack/react-query";
import type { Expect, Equal } from "type-testing";
import { Badge } from "../ui/badge";
import { useStore as useZtore } from "zustand";
import { passwordStore } from "@/stores/password-store";

type OmitProps<
  TComponent extends
    | keyof React.JSX.IntrinsicElements
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | React.JSXElementConstructor<any>,
  TProps extends keyof React.ComponentProps<TComponent>
> = Omit<React.ComponentProps<TComponent>, TProps>;

const locationBiasAtom = atom<placeSchema | undefined>(undefined);
const openAtom = atom(false);
const queryAtomAtom = atom((get) => {
  get(openAtom);

  return {
    inputAtom: atom(""),
    selectedLocationFormAtom: atom<placeSchema | undefined>(undefined),
  };
});

const routeAtom = atom<{
  stops: placeSchema[];
  destination: placeSchema | undefined;
  origin: placeSchema | undefined;
}>({
  stops: [],
  destination: undefined,
  origin: undefined,
});

const stopsAtom = focusAtom(routeAtom, (o) => o.prop("stops"));
const originAtom = focusAtom(routeAtom, (o) => o.prop("origin"));
const destinationAtom = focusAtom(routeAtom, (o) => o.prop("destination"));

function PasswordInput() {
  const password = useZtore(passwordStore, (s) => s.password);
  const setPassword = useZtore(passwordStore, (s) => s.setPassword);

  return (
    <Input
      placeholder="Enter app password"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
    />
  );
}

function TSPFormInner() {
  const [bias, setBias] = useAtom(locationBiasAtom);
  const setOrigin = useSetAtom(originAtom);
  const setDest = useSetAtom(destinationAtom);

  const outerStore = useStore();

  console.log("route", useAtomValue(routeAtom));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 p-6">
        <div className="leading-none font-semibold text-xl">Create a route</div>

        <div className="mt-auto flex flex-col gap-3">
          <PasswordInput />
          <div className="flex flex-col lg:grid lg:grid-cols-2 gap-2">
            <Provider>
              {/* allow the bias form to handle its own state, but the trigger needs the outer scope  */}
              <LocationSelectResponsiveDrawerOrDialog
                locationBias={bias?.location}
                title="Location Bias"
                description="Search for a location. Click save when you're done."
                onSubmit={setBias}
              >
                <SetBiasTrigger jotaiStore={outerStore} />
              </LocationSelectResponsiveDrawerOrDialog>
            </Provider>

            <Provider>
              {/* allow the bias form to handle its own state, but the trigger needs the outer scope  */}
              <LocationSelectResponsiveDrawerOrDialog
                locationBias={bias?.location}
                title="Start Location"
                description="Search for a location. Click save when you're done."
                onSubmit={setOrigin}
              >
                <SetOriginTrigger jotaiStore={outerStore} />
              </LocationSelectResponsiveDrawerOrDialog>
            </Provider>
          </div>

          <StopsArea />

          <Provider>
            {/* allow the bias form to handle its own state, but the trigger needs the outer scope  */}
            <LocationSelectResponsiveDrawerOrDialog
              locationBias={bias?.location}
              title="End Location"
              description="Search for a location. Click save when you're done."
              onSubmit={setDest}
            >
              <SetDestinationTrigger jotaiStore={outerStore} />
            </LocationSelectResponsiveDrawerOrDialog>
          </Provider>
          <RemoveEndButton />
        </div>
      </div>

      <div className="p-2">
        <CalculatedRouteArea />
      </div>
    </div>
  );
}

const queryControllerAtomAtom = atom((get) => {
  const route = get(routeAtom);

  if (!route.origin) return undefined;
  if (route.stops.length < 2) return undefined;

  const queryControllerAtom = atom<{
    enabled: boolean;
    payload: {
      stops: string[];
      destination: string | undefined;
      origin: string;
    };
  }>({
    enabled: false,
    payload: {
      origin: route.origin.id,
      destination: route.destination?.id,
      stops: route.stops.map((x) => x.id),
    },
  });
  return queryControllerAtom;
});

function CalculatedRouteArea() {
  const a = useAtomValue(queryControllerAtomAtom);

  if (!a)
    return (
      <Button disabled variant="secondary" className="w-full">
        Calculate
      </Button>
    );

  return (
    <>
      <ActuallyCalculateButton queryControllerAtom={a} />
      <CalculatedRoutesArea queryControllerAtom={a} />
    </>
  );
}

function CalculatedRoutesArea({
  queryControllerAtom,
}: {
  queryControllerAtom: NonNullable<
    ExtractAtomValue<typeof queryControllerAtomAtom>
  >;
}) {
  const { enabled, payload } = useAtomValue(queryControllerAtom);

  const query = useQuery({
    queryKey: ["tsp", payload],
    enabled,
    // expensive calculation
    staleTime: Infinity,
    queryFn: () => optimizeRoute(payload),
  });

  const perDestinationRoutes = query.data;

  if (!perDestinationRoutes) return undefined;

  if (!enabled) return undefined;

  return (
    <div className="flex flex-col gap-1">
      {perDestinationRoutes
        .slice()
        .sort((a, b) => {
          // sort by ascending distance
          return (a.bike?.meters ?? Infinity) - (b.bike?.meters ?? Infinity);
        })
        .map((x) => {
          return <RoutesForDestination key={x.destination} route={x} />;
        })}
    </div>
  );
}

function RoutesForDestination({
  route: { destination, bike, car },
}: {
  route: routesPerDestinationSchema;
}) {
  const r = useAtomValue(routeAtom);

  if (!bike && !car) {
    return undefined;
  }

  const d =
    r.destination && r.destination.id === destination
      ? r.destination
      : r.stops.find((x) => x.id === destination);

  if (!d) throw new Error("what happened to the destination?");

  return (
    <div className="rounded-md border p-3 bg-background flex flex-col gap-2">
      <div className="flex flex-col items-center">
        <span className="tracking-tight text-sm">
          End: {d.displayName.text}
        </span>
        <span className="tracking-tight text-xs text-muted-foreground">
          {d.formattedAddress}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {bike && (
          <RouteForVehicle
            destination={destination}
            route={bike}
            vehicle={Vehicle.Bike}
          />
        )}
        {car && (
          <RouteForVehicle
            route={car}
            vehicle={Vehicle.Car}
            destination={destination}
          />
        )}
      </div>
    </div>
  );
}

enum Vehicle {
  Bike,
  Car,
}

function RouteForVehicle({
  route,
  vehicle,
  destination,
}: {
  vehicle: Vehicle;
  route: routeSchema;
  destination: string;
}) {
  const getIcon = () => {
    switch (vehicle) {
      case Vehicle.Bike:
        return Bike;
      case Vehicle.Car:
        return Car;
      default:
        type _ = Expect<Equal<typeof vehicle, never>>;
        throw new Error("Unknown vehicle type");
    }
  };

  const Icon = getIcon();

  return (
    <div className="border border-border rounded-sm p-3 flex gap-2 items-center">
      <div className="px-2 shrink-0">
        <Icon className="text-muted-foreground size-7" />
      </div>
      <div className="flex flex-col grow gap-4">
        <div className="flex gap-2">
          <Badge>{route.displayDistance}</Badge>
          <Badge>{route.displayDuration}</Badge>
        </div>
        <div className="flex flex-col divide-y-[1px] divide-border">
          {route.order.map((placeId) => {
            return <A key={placeId} placeId={placeId} />;
          })}
          <A placeId={destination} />
        </div>
      </div>
    </div>
  );
}

function A({ placeId }: { placeId: string }) {
  const route = useAtomValue(routeAtom);

  const found =
    route.stops.find((x) => x.id === placeId) ??
    (route.destination?.id === placeId ? route.destination : undefined);

  if (!found) throw new Error("Place not found in route");

  return (
    <div className="p-1 flex gap-1.5">
      <div className="flex flex-col">
        <span className="text-xs break-all">{found.displayName.text}</span>
        <span className="text-muted-foreground text-xs break-all">
          {found.formattedAddress}
        </span>
      </div>
      <a
        href={found.googleMapsLinks.directionsUri}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          buttonVariants({
            size: "icon-sm",
            variant: "outline",
          }),
          "shrink-0 ml-auto self-start"
        )}
      >
        <Map className="size-3" />
      </a>
    </div>
  );
}

function ActuallyCalculateButton({
  queryControllerAtom,
}: {
  queryControllerAtom: NonNullable<
    ExtractAtomValue<typeof queryControllerAtomAtom>
  >;
}) {
  const [enabled, setEnabled] = useAtom(
    useMemo(() => {
      const enabledAtom = focusAtom(queryControllerAtom, (o) =>
        o.prop("enabled")
      );
      return enabledAtom;
    }, [queryControllerAtom])
  );

  if (enabled) return undefined;

  return (
    <Button
      onClick={() => {
        setEnabled(true);
      }}
      className="w-full"
    >
      Calculate
    </Button>
  );
}

function StopsArea() {
  const bias = useAtomValue(locationBiasAtom);
  const [stops, setStops] = useAtom(stopsAtom);

  return (
    <div className="rounded-md border bg-card border-border text-card-foreground p-2 flex flex-col gap-2">
      <div className="flex justify-between items-start">
        <span className="text-sm font-bold">Stops</span>

        <Provider>
          <LocationSelectResponsiveDrawerOrDialog
            locationBias={bias?.location}
            title="Add Location"
            description="Search for a location. Click save when you're done."
            onSubmit={(place) => {
              setStops((curr) => {
                if (curr.some((x) => x.id === place.id)) {
                  return curr;
                }
                return [...curr, place];
              });
            }}
          >
            <Button size={"icon-sm"}>
              <Plus className="size-4" />
            </Button>
          </LocationSelectResponsiveDrawerOrDialog>
        </Provider>
      </div>

      {stops.length === 0 ? (
        <div className="py-10 grid place-content-center">
          <span className="text-xs text-muted-foreground">No stops added</span>
        </div>
      ) : (
        <ul className="flex flex-col gap-0.5 pl-2">
          {stops.map((stop) => {
            return (
              <li key={stop.id} className="flex items-center gap-2">
                <div className="inline-flex flex-col">
                  <span className="text-sm font-semibold">
                    {stop.displayName.text}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {stop.formattedAddress}
                  </span>
                </div>
                <Button
                  onClick={() => {
                    setStops((curr) => {
                      return curr.filter((x) => !Object.is(stop, x));
                    });
                  }}
                  size={"icon-sm"}
                  variant={"destructive"}
                  className="ml-auto shrink-0"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function TSPForm() {
  return (
    <Provider>
      <TSPFormInner />
    </Provider>
  );
}

const SetOriginTrigger = React.forwardRef<
  HTMLButtonElement,
  OmitProps<typeof Button, "variant" | "className"> & {
    // I need the outer scope
    jotaiStore: ReturnType<typeof createStore>;
  }
>(({ jotaiStore, ...props }, ref) => {
  const locationBias = useAtomValue(originAtom, {
    store: jotaiStore,
  });

  if (!locationBias) {
    return (
      <Button {...props} ref={ref} variant="default">
        Set Start Location
      </Button>
    );
  }

  return (
    <Button
      {...props}
      ref={ref}
      variant={"jade"}
      className="break-all py-2 h-auto min-h-9 whitespace-break-spaces"
    >
      Start: {locationBias.displayName.text} - {locationBias.formattedAddress}
      <Pencil className="size-4 ml-2" />
    </Button>
  );
});

SetOriginTrigger.displayName = "SetOriginTrigger";

const SetDestinationTrigger = React.forwardRef<
  HTMLButtonElement,
  OmitProps<typeof Button, "variant" | "className"> & {
    // I need the outer scope
    jotaiStore: ReturnType<typeof createStore>;
  }
>(({ jotaiStore, ...props }, ref) => {
  const place = useAtomValue(destinationAtom, {
    store: jotaiStore,
  });

  if (!place) {
    return (
      <Button {...props} ref={ref} variant="secondary">
        Set End Location
      </Button>
    );
  }

  return (
    <Button
      {...props}
      ref={ref}
      variant={"destructive"}
      className="break-all py-2 h-auto min-h-9 whitespace-break-spaces"
    >
      End: {place.displayName.text} - {place.formattedAddress}
      <Pencil className="size-4 ml-2" />
    </Button>
  );
});

function RemoveEndButton() {
  const [dest, setDest] = useAtom(destinationAtom);

  if (!dest) return undefined;

  return (
    <Button
      variant="secondary"
      onClick={() => {
        setDest(undefined);
      }}
    >
      Remove End Location
    </Button>
  );
}

SetDestinationTrigger.displayName = "SetDestinationTrigger";

const SetBiasTrigger = React.forwardRef<
  HTMLButtonElement,
  OmitProps<typeof Button, "variant" | "className"> & {
    // I need the outer scope
    jotaiStore: ReturnType<typeof createStore>;
  }
>(({ jotaiStore, ...props }, ref) => {
  const locationBias = useAtomValue(locationBiasAtom, {
    store: jotaiStore,
  });

  if (!locationBias) {
    return (
      <Button {...props} ref={ref} variant="secondary">
        Add Location Bias
      </Button>
    );
  }

  return (
    <Button
      {...props}
      ref={ref}
      variant={"jade"}
      className="break-all py-2 h-auto min-h-9 whitespace-break-spaces"
    >
      Location Bias: {locationBias.displayName.text} -{" "}
      {locationBias.formattedAddress}
      <Pencil className="size-4 ml-2" />
    </Button>
  );
});

SetBiasTrigger.displayName = "SetBiasTrigger";

function LocationSelectResponsiveDrawerOrDialog({
  onSubmit,

  // this should be the trigger and should forwardRef to allow Radix to do its thang
  children,
  description,
  title,
  locationBias,
}: {
  onSubmit: (place: placeSchema) => void;
  title: string;
  description: string;
  locationBias: { longitude: number; latitude: number } | undefined;
} & React.PropsWithChildren) {
  const [open, setOpen] = useAtom(openAtom);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const { inputAtom, selectedLocationFormAtom } = useAtomValue(queryAtomAtom);

  const onSubmitWrapped = (place: placeSchema) => {
    onSubmit(place);
    setOpen(false);
  };

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DrawerOrDialogContent
            locationBias={locationBias}
            onSubmit={onSubmitWrapped}
            inputAtom={inputAtom}
            selectedLocationFormAtom={selectedLocationFormAtom}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <DrawerOrDialogContent
          locationBias={locationBias}
          onSubmit={onSubmitWrapped}
          className="px-4 pb-8"
          inputAtom={inputAtom}
          selectedLocationFormAtom={selectedLocationFormAtom}
        />
      </DrawerContent>
    </Drawer>
  );
}

function DrawerOrDialogContent({
  className,
  inputAtom,
  selectedLocationFormAtom,
  onSubmit,
  locationBias,
}: PropsWithCn<{
  inputAtom: PrimitiveAtom<string>;
  selectedLocationFormAtom: PrimitiveAtom<placeSchema | undefined>;
  onSubmit: (place: placeSchema) => void;
  locationBias: { longitude: number; latitude: number } | undefined;
}>) {
  const [value, setValue] = useAtom(inputAtom);

  const [selected, setSelected] = useAtom(selectedLocationFormAtom);

  const placesQuery = usePlacesQuery(value, locationBias);

  const places = placesQuery.data;

  return (
    <div className={cn("grid items-start gap-6", className)}>
      <div className="grid gap-3">
        <Input
          type="text"
          placeholder="Search for a place"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      {placesQuery.isFetching && <Loader2 className="animate-spin size-4" />}
      {places && (
        <ScrollArea className="h-[60dvh]">
          <div className="grid gap-2">
            {places.map((p) => {
              return (
                <PlaceOptionButton
                  onClick={() => {
                    setSelected(p);
                  }}
                  place={p}
                  key={p.id}
                  isSelected={p.id === selected?.id}
                />
              );
            })}
          </div>
        </ScrollArea>
      )}
      <Button
        type="button"
        disabled={!selected}
        onClick={() => {
          if (!selected) return;
          onSubmit(selected);
        }}
      >
        Save
      </Button>
    </div>
  );
}

function PlaceOptionButton({
  place,
  isSelected,
  onClick,
}: {
  place: placeSchema;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-sm border p-3 animate-in slide-in-from-bottom-5 flex flex-col gap-1 transition-colors cursor-pointer",
        isSelected
          ? "bg-jade-3 hover:bg-jade-4 border-jade-7 border hover:border-jade-8"
          : "bg-card hover:bg-accent"
      )}
      key={place.id}
    >
      <span
        className={cn(
          "font-semibold tracking-tight ",
          isSelected ? "text-jade-11" : "text-card-foreground"
        )}
      >
        {place.displayName.text}
      </span>
      <span className="text-muted-foreground text-xs">
        {place.formattedAddress}
      </span>
    </button>
  );
}
