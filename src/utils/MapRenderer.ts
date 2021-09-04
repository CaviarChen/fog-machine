import mapboxgl from 'mapbox-gl';

export class MapRenderer {
  private static instance = new MapRenderer();
  private map: mapboxgl.Map | null;

  private constructor() {
    this.map = null;
  }

  static get() {
    return MapRenderer.instance;
  }

  registerMap(map: mapboxgl.Map) {
    this.map = map;
  }

  unregisterMap(map: mapboxgl.Map) {
    if (this.map === map) {
      this.map = null;
    }
  }

}