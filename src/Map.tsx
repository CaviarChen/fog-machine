import React, { useEffect, useRef } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl from 'mapbox-gl';
import { MapRenderer } from './utils/MapRenderer'

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN || '';

function Map() {

  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const mapRenderer = MapRenderer.get();

  useEffect(() => {
    if (map.current) return;
    if (!mapContainer.current) return;
    const mapboxMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v10',
    });
    mapboxMap.addControl(new mapboxgl.NavigationControl(), "bottom-right");
    mapboxMap.on("load", () => {
      mapRenderer.registerMap(mapboxMap);
    });
    map.current = mapboxMap;

    return function cleanup() {
      // TODO: This clean up seems wrong
      // mapRenderer.unregisterMap(mapboxMap);
    }
  });

  return (<div ref={mapContainer} className="h-screen z-21" />);
}

export default Map;
