import React, { useEffect, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import "./Map.css";
import mapboxgl from "mapbox-gl";
import { MapRenderer } from "./utils/MapRenderer";

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN || "";

function Map(): JSX.Element {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const deckglContainer = useRef<HTMLCanvasElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const mapRenderer = MapRenderer.get();

  useEffect(() => {
    if (map.current) return;
    if (!mapContainer.current) return;
    if (!deckglContainer.current) return;
    const mapboxMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v10",
    });
    mapboxMap.addControl(new mapboxgl.NavigationControl(), "bottom-right");
    mapboxMap.on("load", () => {
      mapRenderer.registerMap(mapboxMap, deckglContainer.current!);
    });
    map.current = mapboxMap;

    return function cleanup() {
      // TODO: This clean up seems wrong
      // mapRenderer.unregisterMap(mapboxMap);
    };
  });

  return (
    <div className="h-screen">
      <div ref={mapContainer} className="absolute w-full h-full inset-0" />
      <canvas
        ref={deckglContainer}
        className="absolute w-full h-full inset-0 z-10 pointer-events-none opacity-50"
      />
    </div>
  );
}

export default Map;
