import React, { useEffect, useRef } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl from 'mapbox-gl';
import MainMenu from './MainMenu';
import GithubCorner from './GithubCorner';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN || '';

function App() {

  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (map.current) return;
    if (!mapContainer.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11',
    });
    map.current.addControl(new mapboxgl.NavigationControl(), "bottom-right");
  });

  return (
    <div>
      <GithubCorner />
      <MainMenu />
      <div ref={mapContainer} className="h-screen z-20" />
    </div>
  );
}

export default App;
