"use client";

import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import React, { useEffect, useState } from "react";
import { type DeckProps } from "@deck.gl/core";
import { ScatterplotLayer } from "@deck.gl/layers";
import { GoogleMapsOverlay } from "@deck.gl/google-maps";

export default function MapPage() {
  const layers = [
    new ScatterplotLayer<{ position: [number, number] }>({
      id: "deckgl-circle",
      data: [{ position: [0.45, 51.47] }],
      getPosition: (d) => d.position,
      getFillColor: [255, 0, 0, 100],
      getRadius: 1_000,
    }),
  ];

  return (
    <APIProvider apiKey={"AIzaSyDovMk6kz3MxOp7yih1xZtlQ6KIsbR9Q6Q"}>
      <div className="relative h-screen w-screen p-2">
        <div className="absolute inset-4 overflow-clip rounded-xl">
          <Map
            // className="rounded-xl h-full w-full"
            // style={{ width: "100vw", height: "100vh" }}
            defaultCenter={{ lat: 51.47, lng: 0.45 }}
            defaultZoom={11}
            mapId={"50e2bed9131c3f28cd3ec4c9"}
            // gestureHandling="greedy"
            // disableDefaultUI
          >
            <DeckGLOverlay layers={layers} />
          </Map>
        </div>
      </div>
    </APIProvider>
  );
}

function DeckGLOverlay(props: DeckProps) {
  const map = useMap();

  const [overlay] = useState(() => new GoogleMapsOverlay(props));

  useEffect(() => {
    overlay.setMap(map);
    return () => overlay.setMap(null);
  }, [map, overlay]);

  // during render
  overlay.setProps(props);
  return null;
}
