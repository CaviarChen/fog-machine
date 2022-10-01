import React, { useEffect, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import "./Map.css";
import mapboxgl from "mapbox-gl";
import { MapRenderer } from "./utils/MapRenderer";
import { useTranslation } from "react-i18next";
import { initLanguageControl } from "./utils/MapLanguage";

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN || "";

// This componet is a bit sad, we don't want to re-initialize the mapbox/deckgl
// and our `MapRenderer` doesn't handle cleanup correctly. So it shouldn't be
// unmounted and re-mounted. We only use the <Map /> in <App /> and made sure
// that the Props are static. We have a warning message when `MapRenderer` is
// created multiple times.
type Props = {
  initialized(mapRenderer: MapRenderer): void;
  note: "THIS SHOULDN'T BE UNMOUNTED";
};

function Map(props: Props): JSX.Element {
  const { i18n } = useTranslation();
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const deckglContainer = useRef<HTMLCanvasElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (map.current) return;
    if (!mapContainer.current) return;
    if (!deckglContainer.current) return;
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
      const mapRenderer = MapRenderer.create();
      mapRenderer.registerMap(mapboxMap, deckglContainer.current!);
      setMapboxLanguage(i18n.resolvedLanguage);
      i18n.on("languageChanged", (_) => {
        setMapboxLanguage(i18n.resolvedLanguage);
      });
      mapboxMap.resize();

      // give deckgl a little bit of time
      setTimeout(() => {
        props.initialized(mapRenderer);
      }, 200);
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
