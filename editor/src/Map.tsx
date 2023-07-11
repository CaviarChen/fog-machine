import React, { useEffect, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import "./Map.css";
import mapboxgl from "mapbox-gl";
import { MapController } from "./utils/MapController";
import { useTranslation } from "react-i18next";

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN || "";

// This componet is a bit sad, we don't want to re-initialize the mapbox/deckgl
// and our `mapController` doesn't handle cleanup correctly. So it shouldn't be
// unmounted and re-mounted. We only use the <Map /> in <App /> and made sure
// that the Props are static. We have a warning message when `mapController` is
// created multiple times.
type Props = {
  initialized(mapController: MapController): void;
  note: "THIS SHOULDN'T BE UNMOUNTED";
};

function Map(props: Props): JSX.Element {
  const { i18n } = useTranslation();
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (map.current) return;
    if (!mapContainer.current) return;
    console.log("initializing");
    const mapController = MapController.create();
    const mapboxMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapController.mapboxStyleURL(),
      projection: { name: mapController.getMapProjection() },
    });
    mapboxMap.addControl(new mapboxgl.NavigationControl(), "bottom-right");

    mapboxMap.on("load", () => {
      mapController.registerMap(mapboxMap, i18n.resolvedLanguage);
      i18n.on("languageChanged", (_) => {
        mapController.setResolvedLanguage(i18n.resolvedLanguage);
      });
      mapboxMap.resize();

      // give things a little bit of time
      setTimeout(() => {
        props.initialized(mapController);
      }, 200);
    });

    map.current = mapboxMap;

    return function cleanup() {
      // TODO: This clean up seems wrong
      // mapController.unregisterMap(mapboxMap);
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <div ref={mapContainer} className="absolute w-full h-full inset-0" />
      <div className="absolute w-full h-full inset-0 z-10 pointer-events-none"></div>
    </div>
  );
}

export default Map;
