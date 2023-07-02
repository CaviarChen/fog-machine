import React, { useEffect, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import "./Map.css";
import mapboxgl from "mapbox-gl";
import { MapController } from "./utils/MapController";
import { useTranslation } from "react-i18next";
import { MapRenderer, TileIndex } from "./utils/MapRenderer";

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

// https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames#Lon..2Flat._to_tile_numbers_2
function lngLatToTileXY([lng, lat]: number[], zoom: number): [number, number] {
  const n = Math.pow(2, zoom);
  const latRad = (lat / 180) * Math.PI;
  let x = ((lng + 180.0) / 360.0) * n;
  let y =
    ((1.0 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
      2.0) *
    n;

  // const sinLat = Math.sin(lat * Math.PI / 180);
  // let x = ((lng + 180) / 360) * n;
  // let y = (1 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * n;
  x = Math.max(x, 0);
  x = Math.min(x, n - 1);
  y = Math.max(y, 0);
  y = Math.min(y, n - 1);
  return [x, y];
}

function tileXYToLngLat([x, y]: number[], zoom: number): [number, number] {
  const n = Math.pow(2, zoom);
  const lng = (x / n) * 360 - 180;
  const lat =
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  return [lng, lat];
}

function Map(props: Props): JSX.Element {
  const { i18n } = useTranslation();
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const deckglContainer = useRef<HTMLCanvasElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (map.current) return;
    if (!mapContainer.current) return;
    if (!deckglContainer.current) return;
    console.log("initializing");
    const mapController = MapController.create();
    const mapboxMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapController.mapboxStyleURL(),
      // projection: { name: 'globe' },
    });
    mapboxMap.addControl(new mapboxgl.NavigationControl(), "bottom-right");

    mapboxMap.on("load", () => {
      mapController.registerMap(
        mapboxMap,
        deckglContainer.current!,
        i18n.resolvedLanguage
      );
      i18n.on("languageChanged", (_) => {
        mapController.setResolvedLanguage(i18n.resolvedLanguage);
      });
      mapboxMap.resize();

      // --------------------
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      // const ctx = canvas.getContext("2d")!;
      // ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      // ctx.fillRect(0, 0, 512, 512);
      // mapboxMap.addSource('main-canvas-source', {
      //   type: 'canvas',
      //   canvas: canvas,
      //   animate: true,
      //   coordinates: [
      //     [-80.425, 46.437],
      //     [-71.516, 46.437],
      //     [-71.516, 37.936],
      //     [-80.425, 37.936]
      //   ]
      // });
      // mapboxMap.showTileBoundaries = true;
      // mapboxMap.addLayer({
      //   'id': 'main-canvas-layer',
      //   'source': 'main-canvas-source',
      //   'type': 'raster'
      // });
      const mainCanvasSource = mapboxMap.getSource(
        "main-canvas-source"
      ) as mapboxgl.CanvasSource;

      // mapboxMap.on('move', () => {
      //     const bounds = mapboxMap.getBounds();
      //     mainCanvasSource.setCoordinates([
      //       bounds.getNorthEast().toArray(),
      //       bounds.getNorthWest().toArray(),
      //       bounds.getSouthWest().toArray(),
      //       bounds.getSouthEast().toArray(),
      //     ]);
      // });

      // mapboxMap.on("moveend", () => {
      //   const zoom = Math.floor(mapboxMap.getZoom()) + 1;
      //   console.log(zoom);
      //   const bounds = mapboxMap.getBounds();
      //   let topLeft = lngLatToTileXY(bounds.getNorthWest().toArray(), zoom);
      //   let bottomRight = lngLatToTileXY(bounds.getSouthEast().toArray(), zoom);
      //   console.log("a", topLeft, bottomRight);
      //   topLeft = [Math.floor(topLeft[0]), Math.floor(topLeft[1])];
      //   bottomRight = [Math.floor(bottomRight[0]), Math.floor(bottomRight[1])];
      //   const actualBounds = new mapboxgl.LngLatBounds(
      //     tileXYToLngLat(topLeft, zoom),
      //     tileXYToLngLat([bottomRight[0] + 1, bottomRight[1] + 1], zoom)
      //   );
      //   console.log("b", topLeft, bottomRight);

      //   canvas.width = 512 * (bottomRight[0] - topLeft[0] + 1);
      //   canvas.height = 512 * (bottomRight[1] - topLeft[1] + 1);
      //   const ctx = canvas.getContext("2d")!;

      //   // ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      //   // ctx.fillRect(0, 0, canvas.width, canvas.height);
      //   ctx.clearRect(0, 0, canvas.width, canvas.height);

      //   console.log("-----");
      //   for (let x = topLeft[0]; x <= bottomRight[0]; x++) {
      //     for (let y = topLeft[1]; y <= bottomRight[1]; y++) {
      //       console.log(".", x, y);
      //       // const tileCanvas = MapRenderer.drawFogCanvas(mapController.fogMap, new TileIndex(x, y, zoom));
      //       // ctx.drawImage(tileCanvas, (x - topLeft[0]) * 512, (y - topLeft[1]) * 512);
      //     }
      //   }
      //   console.log("-----");

      //   // mainCanvasSource.setCoordinates([
      //   //   actualBounds.getSouthWest().toArray(),
      //   //   actualBounds.getSouthEast().toArray(),
      //   //   actualBounds.getNorthEast().toArray(),
      //   //   actualBounds.getNorthWest().toArray(),
      //   // ]);
      // });
      // // --------------------

      // give deckgl a little bit of time
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
      <div className="absolute w-full h-full inset-0 z-10 pointer-events-none">
        <canvas
          // `mapController` will set the opacity of this canvas to control the fog concentration.
          ref={deckglContainer}
        />
      </div>
    </div>
  );
}

export default Map;
