import { z } from "zod";
import { POST } from "./fetch";

const placeSchema = z.object({
  id: z.string(),
  formattedAddress: z.string(),
  googleMapsUri: z.string(),
  displayName: z.object({
    text: z.string(),
  }),
  googleMapsLinks: z.object({
    directionsUri: z.string(),
  }),
  location: z.object({
    longitude: z.number(),
    latitude: z.number(),
  }),
});

export const testPlaces: {
  origin: placeSchema;
  stops: placeSchema[];
  destination: placeSchema;
} = {
  origin: {
    id: "ChIJMyz2gkXGxokRcCqrYbUuia4",
    formattedAddress: "Jones Way, Philadelphia, PA 19104, USA",
    googleMapsUri: "https://maps.google.com/?cid=12576634790971386480",
    displayName: {
      text: "Penn Ice Rink",
    },
    googleMapsLinks: {
      directionsUri:
        "https://www.google.com/maps/dir//''/data=!4m7!4m6!1m1!4e2!1m2!1m1!1s0x89c6c64582f62c33:0xae892eb561ab2a70!3e0",
    },
    location: {
      longitude: -75.1865487,
      latitude: 39.951710899999995,
    },
  },
  stops: [
    {
      id: "Ei8yNjAwIFcgRmxldGNoZXIgU3QsIFBoaWxhZGVscGhpYSwgUEEgMTkxMzIsIFVTQSIxEi8KFAoSCQkYPhPtx8aJEbzdT0DCUQ4UEKgUKhQKEgld1z_HksfGiREWTRpp3WzGpw",
      formattedAddress: "2600 W Fletcher St, Philadelphia, PA 19132, USA",
      googleMapsUri:
        "https://maps.google.com/?q=2600+W+Fletcher+St,+Philadelphia,+PA+19132,+USA&ftid=0x89c6c7ed133e1809:0xcad8e8d0e99f5b8f",
      displayName: {
        text: "2600 W Fletcher St",
      },
      googleMapsLinks: {
        directionsUri:
          "https://www.google.com/maps/dir//39.9895972,-75.1754455/data=!4m5!4m4!1m1!4e2!1m0!3e0",
      },
      location: {
        longitude: -75.1754455,
        latitude: 39.9895972,
      },
    },
    {
      id: "ChIJ5TjjILHHxokRsUNYkTmxXGg",
      formattedAddress: "9 Boathouse Row, Philadelphia, PA 19130, USA",
      googleMapsUri: "https://maps.google.com/?cid=7520080338611618737",
      displayName: {
        text: "Malta Boat Club",
      },
      googleMapsLinks: {
        directionsUri:
          "https://www.google.com/maps/dir//''/data=!4m7!4m6!1m1!4e2!1m2!1m1!1s0x89c6c7b120e338e5:0x685cb139915843b1!3e0",
      },
      location: {
        longitude: -75.18786659999999,
        latitude: 39.969456799999996,
      },
    },
    {
      id: "ChIJpZVajITHxokRZT6VDp4tvtk",
      formattedAddress:
        "Strawberry Mansion Bridge Dr, Philadelphia, PA 19131, USA",
      googleMapsUri: "https://maps.google.com/?cid=15690028308678131301",
      displayName: {
        text: "Strawberry Mansion Bridge",
      },
      googleMapsLinks: {
        directionsUri:
          "https://www.google.com/maps/dir//''/data=!4m7!4m6!1m1!4e2!1m2!1m1!1s0x89c6c7848c5a95a5:0xd9be2d9e0e953e65!3e0",
      },
      location: {
        longitude: -75.19380989999999,
        latitude: 39.9952718,
      },
    },
    {
      id: "ChIJ76GvGOvGxokR_qrOIBats84",
      formattedAddress: "4900 Baltimore Ave, Philadelphia, PA 19143, USA",
      googleMapsUri: "https://maps.google.com/?cid=14894438703195663102",
      displayName: {
        text: "4900 Baltimore Ave",
      },
      googleMapsLinks: {
        directionsUri:
          "https://www.google.com/maps/dir//''/data=!4m7!4m6!1m1!4e2!1m2!1m1!1s0x89c6c6eb18afa1ef:0xceb3ad1620ceaafe!3e0",
      },
      location: {
        longitude: -75.22126449999999,
        latitude: 39.947919899999995,
      },
    },
    {
      id: "Ei80MDAwIEJhbHRpbW9yZSBBdmUsIFBoaWxhZGVscGhpYSwgUEEgMTkxMDQsIFVTQSIxEi8KFAoSCSEZCX32xsaJEUD0EsV6XxKxEKAfKhQKEglDzC0av8bGiRH86g2jblqjdA",
      formattedAddress: "4000 Baltimore Ave, Philadelphia, PA 19104, USA",
      googleMapsUri:
        "https://maps.google.com/?q=4000+Baltimore+Ave,+Philadelphia,+PA+19104,+USA&ftid=0x89c6c6f67d091921:0xe3f8dcf9e6306713",
      displayName: {
        text: "4000 Baltimore Ave",
      },
      googleMapsLinks: {
        directionsUri:
          "https://www.google.com/maps/dir//39.9499483,-75.2034621/data=!4m5!4m4!1m1!4e2!1m0!3e0",
      },
      location: {
        longitude: -75.2034621,
        latitude: 39.949948299999996,
      },
    },
    {
      id: "ChIJXSJY2vfGxokRSeHsSBbDiGI",
      formattedAddress: "3939 Lancaster Ave, Philadelphia, PA 19104, USA",
      googleMapsUri: "https://maps.google.com/?cid=7100139313029767497",
      displayName: {
        text: "Neighborhood Bike Works",
      },
      googleMapsLinks: {
        directionsUri:
          "https://www.google.com/maps/dir//''/data=!4m7!4m6!1m1!4e2!1m2!1m1!1s0x89c6c6f7da58225d:0x6288c31648ece149!3e0",
      },
      location: {
        longitude: -75.20097830000002,
        latitude: 39.9626774,
      },
    },
    {
      id: "ChIJ9Sdt-zHGxokRad5acsk-ifo",
      formattedAddress: "16th St. & JFK Blvd., Philadelphia, PA 19102, USA",
      googleMapsUri: "https://maps.google.com/?cid=18053029616219250281",
      displayName: {
        text: "Suburban",
      },
      googleMapsLinks: {
        directionsUri:
          "https://www.google.com/maps/dir//''/data=!4m7!4m6!1m1!4e2!1m2!1m1!1s0x89c6c631fb6d27f5:0xfa893ec9725ade69!3e0",
      },
      location: {
        longitude: -75.1667633,
        latitude: 39.954218999999995,
      },
    },
    {
      id: "ChIJZxBULUDGxokRj3Dr_aK3YuQ",
      formattedAddress: "2201 Christian St, Philadelphia, PA 19146, USA",
      googleMapsUri: "https://maps.google.com/?cid=16456917899037864079",
      displayName: {
        text: "2201 Christian St",
      },
      googleMapsLinks: {
        directionsUri:
          "https://www.google.com/maps/dir//''/data=!4m7!4m6!1m1!4e2!1m2!1m1!1s0x89c6c6402d541067:0xe462b7a2fdeb708f!3e0",
      },
      location: {
        longitude: -75.1794592,
        latitude: 39.9418602,
      },
    },
  ],
  destination: {
    id: "ChIJGQERLknGxokRZf8LALd6Nig",
    formattedAddress: "3000 Market St, Philadelphia, PA 19104, USA",
    googleMapsUri: "https://maps.google.com/?cid=2897638336657882981",
    displayName: {
      text: "30th St",
    },
    googleMapsLinks: {
      directionsUri:
        "https://www.google.com/maps/dir//''/data=!4m7!4m6!1m1!4e2!1m2!1m1!1s0x89c6c6492e110119:0x28367ab7000bff65!3e0",
    },
    location: {
      longitude: -75.1843509,
      latitude: 39.9549496,
    },
  },
};

export type placeSchema = z.infer<typeof placeSchema>;

export const placesSearch = async (payload: {
  query: string;
  locationBias?: {
    latitude: number;
    longitude: number;
  };
}) => {
  const res = await POST(`/places/search`, {
    body: payload,
  });

  return placeSchema.array().parse(res);
};

export enum OptimizeResponseType {
  FixedDestination,
  VariableDestination,
}

export const optimizeRoute = async (payload: {
  origin: string;
  stops: string[];
  destination: string | undefined;
}): Promise<{
  type: OptimizeResponseType;
  orderings: string[][];
}> => {
  const res = await POST(`/places/optimize`, {
    body: payload satisfies {
      origin: string;
      stops: string[];
      destination: string | undefined;
    },
  });

  // const orderings: string[][] = [];

  // const out = orderings.map((o) => {
  //   const placesOrdered = o.map((id) => {
  //     const place =
  //       payload.stops.find((s) => s.id === id) ??
  //       (payload.destination?.id === id ? payload.destination : undefined);

  //     if (!place) throw new Error("Place not found in orderings");
  //     return place;
  //   });

  //   return placesOrdered;
  // });

  if (payload.destination) {
    return {
      type: OptimizeResponseType.FixedDestination,
      orderings: out,
    };
  } else {
    return {
      type: OptimizeResponseType.VariableDestination,
      orderings: out,
    };
  }
};
