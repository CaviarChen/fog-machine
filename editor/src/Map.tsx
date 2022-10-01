import React, { useEffect, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import "./Map.css";
import mapboxgl from "mapbox-gl";
import { MapRenderer } from "./utils/MapRenderer";
import { useTranslation } from "react-i18next";
import { initLanguageControl } from "./utils/MapLanguage";

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN || "";

type Props = {
  setLoaded(isLoaded: boolean): void;
  mapOnLoaded(): void;
  mapRendererOnChange(): void;
};

function Map(props: Props): JSX.Element {
  const { i18n } = useTranslation();
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const deckglContainer = useRef<HTMLCanvasElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const mapRenderer = MapRenderer.get();

  useEffect(() => {
    if (map.current) return;
    if (!mapContainer.current) return;
    if (!deckglContainer.current) return;
    console.log("initializing");
    const mapboxMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v11",
    });
    mapboxMap.addControl(new mapboxgl.NavigationControl(), "bottom-right");
    const setMapboxLanguage = initLanguageControl(
      mapboxMap,
      i18n.resolvedLanguage
    );

    mapboxMap.on("load", () => {
      mapRenderer.registerMap(mapboxMap, deckglContainer.current!, () => {
        props.mapRendererOnChange();
      });
      setMapboxLanguage(i18n.resolvedLanguage);
      i18n.on("languageChanged", (_) => {
        setMapboxLanguage(i18n.resolvedLanguage);
      });
      mapboxMap.resize();

      props.mapOnLoaded();
    });
    map.current = mapboxMap;

    return function cleanup() {
      // TODO: This clean up seems wrong
      // mapRenderer.unregisterMap(mapboxMap);
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <div ref={mapContainer} className="absolute w-full h-full inset-0" />
      <canvas
        ref={deckglContainer}
        className="absolute w-full h-full inset-0 z-10 pointer-events-none opacity-50"
      />
    </div>
  );
}

export default Map;
