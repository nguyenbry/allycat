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
  _testPlaces,
  OptimizePlace,
} from "@/fetcher/fetchers";
import {
  atom,
  createStore,
  type ExtractAtomValue,
  type PrimitiveAtom,
  Provider,
  useAtom,
  useAtomValue,
  useSetAtom,
  useStore,
} from "jotai";
import { usePlacesQuery } from "./places-search-test";
import { Bike, Car, Loader2, Map, Pencil, Plus, Trash2, X } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { type PropsWithCn } from "../types";
import { useMemo } from "use-memo-one";
import { useQuery } from "@tanstack/react-query";
import type { Expect, Equal } from "type-testing";
import { Badge } from "../ui/badge";
import { useStore as useZtore } from "zustand";
import { passwordStore } from "@/stores/password-store";
import * as R from "remeda";
import { atomWithReset, RESET, useHydrateAtoms } from "jotai/utils";

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
    inputAtom: atomWithReset(""),
    selectedLocationFormAtom: atomWithReset<placeSchema | undefined>(undefined),
  };
});

type Route = {
  stops: placeSchema[];
  destination: placeSchema | undefined;
  origin: placeSchema | undefined;
};

const testRoute: Route = {
  stops: [
    {
      id: "ChIJcRzlRgbIxokR1yUtRPv8u4I",
      formattedAddress: "2400 N 11th St, Philadelphia, PA 19133, USA",
      googleMapsUri:
        "https://maps.google.com/?cid=9420401201686324695&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQABgEIAA",
      displayName: {
        text: "2400 N 11th St",
      },
      googleMapsLinks: {
        directionsUri:
          "https://www.google.com/maps/dir//''/data=!4m7!4m6!1m1!4e2!1m2!1m1!1s0x89c6c80646e51c71:0x82bbfcfb442d25d7!3e0?g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQABgEIAA",
      },
      location: {
        longitude: -75.1506503,
        latitude: 39.9891357,
      },
    },
    {
      id: "ChIJkTEFDHy4xokR3y81rj83fmI",
      formattedAddress: "4208-52 Ridge Ave, Philadelphia, PA 19129, USA",
      googleMapsUri:
        "https://maps.google.com/?cid=7097170809427668959&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQABgEIAA",
      displayName: {
        text: "Inn Yard Park",
      },
      googleMapsLinks: {
        directionsUri:
          "https://www.google.com/maps/dir//''/data=!4m7!4m6!1m1!4e2!1m2!1m1!1s0x89c6b87c0c053191:0x627e373fae352fdf!3e0?g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQABgEIAA",
      },
      location: {
        longitude: -75.1953324,
        latitude: 40.0090982,
      },
    },
    {
      id: "ChIJ38WZZl3JxokRvVzKlOrKDOw",
      formattedAddress: "3176 Richmond St, Philadelphia, PA 19134, USA",
      googleMapsUri:
        "https://maps.google.com/?cid=17009193001538968765&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQABgEIAA",
      displayName: {
        text: "Tshatshke Jewelry Studio",
      },
      googleMapsLinks: {
        directionsUri:
          "https://www.google.com/maps/dir//''/data=!4m7!4m6!1m1!4e2!1m2!1m1!1s0x89c6c95d6699c5df:0xec0ccaea94ca5cbd!3e0?g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQABgEIAA",
      },
      location: {
        longitude: -75.1019638,
        latitude: 39.9829054,
      },
    },
    {
      id: "ChIJHxQlmGTIxokRVN3mcBkfOIk",
      formattedAddress: "700 N 2nd St, Philadelphia, PA 19123, USA",
      googleMapsUri:
        "https://maps.google.com/?cid=9887687176020745556&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQABgEIAA",
      displayName: {
        text: "The 700",
      },
      googleMapsLinks: {
        directionsUri:
          "https://www.google.com/maps/dir//''/data=!4m7!4m6!1m1!4e2!1m2!1m1!1s0x89c6c8649825141f:0x89381f1970e6dd54!3e0?g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQABgEIAA",
      },
      location: {
        longitude: -75.1413974,
        latitude: 39.9620591,
      },
    },
    {
      id: "ChIJ1waJqZzIxokR49XlZ1tqfnw",
      formattedAddress: "422 Walnut St, Philadelphia, PA 19106, USA",
      googleMapsUri:
        "https://maps.google.com/?cid=8970724448586290659&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQABgEIAA",
      displayName: {
        text: "Rose Garden",
      },
      googleMapsLinks: {
        directionsUri:
          "https://www.google.com/maps/dir//''/data=!4m7!4m6!1m1!4e2!1m2!1m1!1s0x89c6c89ca98906d7:0x7c7e6a5b67e5d5e3!3e0?g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQABgEIAA",
      },
      location: {
        longitude: -75.1488246,
        latitude: 39.94694,
      },
    },
    {
      id: "ChIJb6_MyifGxokRpoGQe70D8ek",
      formattedAddress: "235 S 10th St, Philadelphia, PA 19107, USA",
      googleMapsUri:
        "https://maps.google.com/?cid=16857258992581247398&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQABgEIAA",
      displayName: {
        text: "Locust Bar/Club",
      },
      googleMapsLinks: {
        directionsUri:
          "https://www.google.com/maps/dir//''/data=!4m7!4m6!1m1!4e2!1m2!1m1!1s0x89c6c627caccaf6f:0xe9f103bd7b9081a6!3e0?g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQABgEIAA",
      },
      location: {
        longitude: -75.1575275,
        latitude: 39.9472387,
      },
    },
    {
      id: "ChIJqWIkSA_GxokRc4T8-pBAwbU",
      formattedAddress: "1300 McKean St, Philadelphia, PA 19148, USA",
      googleMapsUri:
        "https://maps.google.com/?cid=13096820182800434291&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQABgEIAA",
      displayName: {
        text: "1300 McKean St",
      },
      googleMapsLinks: {
        directionsUri:
          "https://www.google.com/maps/dir//''/data=!4m7!4m6!1m1!4e2!1m2!1m1!1s0x89c6c60f482462a9:0xb5c14090fafc8473!3e0?g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQABgEIAA",
      },
      location: {
        longitude: -75.16747749999999,
        latitude: 39.925222399999996,
      },
    },
    {
      id: "ChIJS_Tsp27GxokRNn46MDX2rrM",
      formattedAddress: "2300 Wharton St, Philadelphia, PA 19146, USA",
      googleMapsUri:
        "https://maps.google.com/?cid=12947556687039594038&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQABgEIAA",
      displayName: {
        text: "Wharton Square Playground",
      },
      googleMapsLinks: {
        directionsUri:
          "https://www.google.com/maps/dir//''/data=!4m7!4m6!1m1!4e2!1m2!1m1!1s0x89c6c66ea7ecf44b:0xb3aef635303a7e36!3e0?g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQABgEIAA",
      },
      location: {
        longitude: -75.1837832,
        latitude: 39.9360454,
      },
    },
    {
      id: "ChIJIQ0RF0fGxokRRBPTCYK7s-o",
      formattedAddress: "Fitler Square, Philadelphia, PA, USA",
      googleMapsUri:
        "https://maps.google.com/?cid=16912067192891315012&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQABgEIAA",
      displayName: {
        text: "Fitler Square",
      },
      googleMapsLinks: {
        directionsUri:
          "https://www.google.com/maps/dir//''/data=!4m7!4m6!1m1!4e2!1m2!1m1!1s0x89c6c64717110d21:0xeab3bb8209d31344!3e0?g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQABgEIAA",
      },
      location: {
        longitude: -75.1793444,
        latitude: 39.9474746,
      },
    },
    {
      id: "ChIJrcsBU8vHxokR4FXP2BplJks",
      formattedAddress:
        "2025 Benjamin Franklin Pkwy, Philadelphia, PA 19130, USA",
      googleMapsUri:
        "https://maps.google.com/?cid=5415126767940621792&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQABgEIAA",
      displayName: {
        text: "Barnes Foundation",
      },
      googleMapsLinks: {
        directionsUri:
          "https://www.google.com/maps/dir//''/data=!4m7!4m6!1m1!4e2!1m2!1m1!1s0x89c6c7cb5301cbad:0x4b26651ad8cf55e0!3e0?g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQABgEIAA",
      },
      location: {
        longitude: -75.17280749999999,
        latitude: 39.9606433,
      },
    },
    {
      id: "ChIJT1ozjUvHxokR3LneNPIS4qE",
      formattedAddress: "300-50 Saunders Ave, Philadelphia, PA 19104, USA",
      googleMapsUri:
        "https://maps.google.com/?cid=11664906816321403356&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQABgEIAA",
      displayName: {
        text: "Saunders Park",
      },
      googleMapsLinks: {
        directionsUri:
          "https://www.google.com/maps/dir//''/data=!4m7!4m6!1m1!4e2!1m2!1m1!1s0x89c6c74b8d335a4f:0xa1e212f234deb9dc!3e0?g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQABgEIAA",
      },
      location: {
        longitude: -75.19938719999999,
        latitude: 39.9600151,
      },
    },
    {
      id: "ChIJbyyRSfLGxokRDJARJE7eV9o",
      formattedAddress: "4300-4398 Baltimore Ave, Philadelphia, PA 19104, USA",
      googleMapsUri:
        "https://maps.google.com/?cid=15733288250436063244&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQABgEIAA",
      displayName: {
        text: "Clark Park",
      },
      googleMapsLinks: {
        directionsUri:
          "https://www.google.com/maps/dir//''/data=!4m7!4m6!1m1!4e2!1m2!1m1!1s0x89c6c6f249912c6f:0xda57de4e2411900c!3e0?g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQABgEIAA",
      },
      location: {
        longitude: -75.2104142,
        latitude: 39.9488973,
      },
    },
  ],
  destination: {
    id: "ChIJc7SgtIvGxokRPBKj0H0XXPQ",
    formattedAddress: "3600 Grays Ferry Ave, Philadelphia, PA 19146, USA",
    googleMapsUri:
      "https://maps.google.com/?cid=17607974472250495548&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQABgEIAA",
    displayName: {
      text: "Grays Ferry Crescent Skatepark",
    },
    googleMapsLinks: {
      directionsUri:
        "https://www.google.com/maps/dir//''/data=!4m7!4m6!1m1!4e2!1m2!1m1!1s0x89c6c68bb4a0b473:0xf45c177dd0a3123c!3e0?g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQABgEIAA",
    },
    location: {
      longitude: -75.20420159999999,
      latitude: 39.9409798,
    },
  },
  origin: {
    id: "ChIJmZ0KYn_IxokRIBmPHZq5kPc",
    formattedAddress: "1000-02 Spring Garden St, Philadelphia, PA 19123, USA",
    googleMapsUri:
      "https://maps.google.com/?cid=17838962195586554144&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQABgEIAA",
    displayName: {
      text: "1000-02 Spring Garden St",
    },
    googleMapsLinks: {
      directionsUri:
        "https://www.google.com/maps/dir//''/data=!4m7!4m6!1m1!4e2!1m2!1m1!1s0x89c6c87f620a9d99:0xf790b99a1d8f1920!3e0?g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQABgEIAA",
    },
    location: {
      longitude: -75.1545378,
      latitude: 39.9614429,
    },
  },
};

const routeAtom = atom<Route>({
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

function SetLocationBiasButton() {
  const [bias, setBias] = useAtom(locationBiasAtom);
  const outerStore = useStore();
  const [s] = React.useState(() => createStore());

  // this one should be open first
  useHydrateAtoms([[openAtom, true]], { store: s });

  return (
    <Provider store={s}>
      {/* allow the bias form to handle its own state, but the trigger needs the outer scope  */}
      <LocationSelectResponsiveDrawerOrDialog
        locationBias={bias?.location}
        title="Location Bias"
        description="Choose a common landmark around your route. Subsequent searches will prioritize results near this location."
        onSubmit={setBias}
      >
        <SetBiasTrigger jotaiStore={outerStore} />
      </LocationSelectResponsiveDrawerOrDialog>
    </Provider>
  );
}

function TSPFormInner() {
  const bias = useAtomValue(locationBiasAtom);
  const setOrigin = useSetAtom(originAtom);
  const setDest = useSetAtom(destinationAtom);

  const outerStore = useStore();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 p-6">
        <div className="leading-none font-semibold text-xl">Create a route</div>

        <div className="mt-auto flex flex-col gap-3">
          <PasswordInput />
          <div className="flex flex-col lg:grid lg:grid-cols-2 gap-2">
            <SetLocationBiasButton />

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
      stops: OptimizePlace[];
      destination: OptimizePlace | undefined;
      origin: OptimizePlace;
    };
  }>({
    enabled: false,
    payload: {
      origin: {
        id: route.origin.id,
        ...route.origin.location,
      } satisfies OptimizePlace,
      destination: route.destination && {
        id: route.destination.id,
        ...route.destination.location,
      },
      stops: route.stops.map((x) => ({
        id: x.id,
        ...x.location,
      })),
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

function minLen2<T>(arr: T[]): arr is [T, T, ...T[]] {
  return arr.length > 1;
}

function CalculatedRoutesArea({
  queryControllerAtom,
}: {
  queryControllerAtom: NonNullable<
    ExtractAtomValue<typeof queryControllerAtomAtom>
  >;
}) {
  const { enabled, payload } = useAtomValue(queryControllerAtom);

  const canFetch = minLen2(payload.stops);

  const query = useQuery({
    queryKey: ["tsp", payload],
    enabled: enabled && canFetch,
    // expensive calculation
    staleTime: Infinity,
    queryFn: () => {
      if (minLen2(payload.stops)) {
        return optimizeRoute({
          stops: payload.stops,
          destination: payload.destination,
          origin: payload.origin,
        });
      } else {
        throw new Error("BUG, should properly enable the query when ready");
      }
    },
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
  route: { destination, bike, car, method },
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
    <div
      className={cn(
        "rounded-md border p-3 bg-background flex flex-col gap-2",
        method === "tsp" && "border-emerald-500"
      )}
    >
      <div className="flex flex-col items-start">
        <span className="tracking-tight text-sm font-bold">
          End: {d.displayName.text}
        </span>
        <span className="tracking-tight text-xs text-muted-foreground">
          {d.formattedAddress}
        </span>
      </div>

      <div className="flex flex-col divide-y-[1px] divide-border">
        {bike && (
          <RouteForVehicle
            destination={destination}
            route={bike}
            vehicle={Vehicle.Bike}
          />
        )}
        {iife(() => {
          /**
           * Only return car card if routes aren't the same
           */
          if (!car) return undefined;

          const carRouteSameAsBikeRoute =
            bike && R.isDeepEqual(bike.order, car.order);

          if (carRouteSameAsBikeRoute) return undefined;

          return (
            <RouteForVehicle
              route={car}
              vehicle={Vehicle.Car}
              destination={destination}
            />
          );
        })}
      </div>
    </div>
  );
}

function iife<T>(fn: () => T): T {
  return fn();
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
    <div className="py-4 flex gap-2 items-center">
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
          <A placeId={destination} isEnd />
        </div>
      </div>
    </div>
  );
}

function A({ placeId, isEnd }: { placeId: string; isEnd?: true }) {
  const route = useAtomValue(routeAtom);

  const found =
    route.stops.find((x) => x.id === placeId) ??
    (route.destination?.id === placeId ? route.destination : undefined);

  if (!found) throw new Error("Place not found in route");

  return (
    <div className="p-1 flex gap-1.5">
      <div className="flex flex-col">
        <span className={cn("text-xs break-all", isEnd && "text-jade-11")}>
          {found.displayName.text}
        </span>
        <span
          className={cn(
            "text-muted-foreground text-xs break-all",
            isEnd && "text-jade-12"
          )}
        >
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
            keepOpen
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
  keepOpen,
}: {
  onSubmit: (place: placeSchema) => void;
  title: string;
  description: string;
  locationBias: { longitude: number; latitude: number } | undefined;
  keepOpen?: true;
} & React.PropsWithChildren) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [open, setOpen] = useAtom(openAtom);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const { inputAtom, selectedLocationFormAtom } = useAtomValue(queryAtomAtom);

  const setInput = useSetAtom(inputAtom);
  const setSelectedLocation = useSetAtom(selectedLocationFormAtom);

  const onSubmitWrapped = (place: placeSchema) => {
    onSubmit(place);
    if (keepOpen) {
      setInput(RESET);
      setSelectedLocation(RESET);
      inputRef.current?.focus();
    } else {
      setOpen(false);
    }
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
            ref={inputRef}
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
      <DrawerContent className="h-[90dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <DrawerOrDialogContent
          ref={inputRef}
          locationBias={locationBias}
          onSubmit={onSubmitWrapped}
          className="px-4 grow"
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
  ref,
}: PropsWithCn<{
  inputAtom: PrimitiveAtom<string>;
  selectedLocationFormAtom: PrimitiveAtom<placeSchema | undefined>;
  onSubmit: (place: placeSchema) => void;
  locationBias: { longitude: number; latitude: number } | undefined;
}> & { ref?: React.Ref<HTMLInputElement> }) {
  const [value, setValue] = useAtom(inputAtom);

  const placesQuery = usePlacesQuery(value, locationBias);

  const heightAtom = useMemo(() => {
    return atom<number | undefined>(undefined);
  }, []);

  const h = useAtomValue(heightAtom);

  const places = placesQuery.data;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="grid gap-3">
        <Input
          aria-invalid={places && places.length === 0 ? true : false}
          ref={ref}
          type="text"
          placeholder="Search for a place"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      {placesQuery.isFetching && (
        <div className="flex py-4">
          <Loader2 className="animate-spin size-6 mx-auto" />
        </div>
      )}

      {places ? (
        places.length > 0 ? (
          <Box
            className="grow min-h-[30dvh] overflow-clip relative inline-flex"
            heightAtom={heightAtom}
          >
            {h !== undefined && (
              <div className="absolute top-0 left-0 right-0">
                <ScrollArea
                  style={{
                    height: h,
                  }}
                >
                  <div className="grid gap-2">
                    {places.map((p) => {
                      return (
                        <PlaceOptionButton
                          onClick={() => onSubmit(p)}
                          place={p}
                          key={p.id}
                          isSelected={false}
                        />
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}
          </Box>
        ) : (
          <div className="flex text-muted-foreground flex-col my-auto">
            <X className="size-10 mx-auto" />
            <span className="text-xs text-wrap text-center">
              No results found for &apos;{value}&apos;
            </span>
          </div>
        )
      ) : undefined}
    </div>
  );
}

function Box({
  heightAtom,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  heightAtom: PrimitiveAtom<number | undefined>;
}) {
  const set = useSetAtom(heightAtom);

  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const e = ref.current;

    if (!e) return;

    const r = new ResizeObserver(([entry]) => {
      const contentHeight = entry.contentRect.height;
      set(contentHeight);
    });

    r.observe(e);

    return () => {
      r.disconnect();
      set(undefined);
    };
  }, [set]);

  return <div {...props} ref={ref} />;
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
