import React, { useEffect, useRef, useState } from "react";
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
  const [eraserMode, setEraserMode] = useState(false);

  useEffect(() => {
    mapRenderer.setEraserMod(eraserMode);
  }, [eraserMode]);

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
    <div className="absolute inset-0">
      <div ref={mapContainer} className="absolute w-full h-full inset-0" />
      <canvas
        ref={deckglContainer}
        className="absolute w-full h-full inset-0 z-10 pointer-events-none opacity-50"
      />
      <div className="absolute bottom-0 pb-4 z-10 pointer-events-none flex justify-center w-full">
        <button
          className={
            "flex items-center justify-center w-9 h-9 p-2 pointer-events-auto bg-white shadow rounded-lg hover:bg-gray-200" +
            (eraserMode ? " ring-4 ring-gray-700" : "")
          }
          onClick={() => {
            setEraserMode(!eraserMode);
          }}
        >
          {iconEraserSolid}
        </button>
      </div>
    </div>
  );
}

export default Map;

const iconEraserSolid = (
  <svg
    aria-hidden="true"
    focusable="false"
    data-prefix="fas"
    data-icon="eraser"
    role="img"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    className="w-full h-full"
  >
    <path
      fill="currentColor"
      d="M497.941 273.941c18.745-18.745 18.745-49.137 0-67.882l-160-160c-18.745-18.745-49.136-18.746-67.883 0l-256 256c-18.745 18.745-18.745 49.137 0 67.882l96 96A48.004 48.004 0 0 0 144 480h356c6.627 0 12-5.373 12-12v-40c0-6.627-5.373-12-12-12H355.883l142.058-142.059zm-302.627-62.627l137.373 137.373L265.373 416H150.628l-80-80 124.686-124.686z"
    ></path>
  </svg>
);
