// TODO: consider reactify this?
import mapboxgl from 'mapbox-gl';
import * as fogMap from './FogMap';
import * as tileLayer from './TileLayer';

export class MapRenderer {
  private static instance = new MapRenderer();
  private map: mapboxgl.Map | null;
  private fogMap: fogMap.Map;

  private constructor() {
    this.map = null;
    this.fogMap = new fogMap.Map();
  }

  static get() {
    return MapRenderer.instance;
  }

  registerMap(map: mapboxgl.Map) {
    this.map = map;
    new tileLayer.TileLayer(map, this.onLoadTileCanvas)
  }

  unregisterMap(map: mapboxgl.Map) {
    if (this.map === map) {
      this.map = null;
    }
  }

  addFoGFile(filename: string, data: ArrayBuffer) {
    let newTile = this.fogMap.addFile(filename, data);
    if (newTile) {
      // TODO
    }
  }

  private onLoadTileCanvas(tile: tileLayer.Tile) {
    console.log(tile);

    let canvas = document.createElement("canvas");
    let ctx = canvas.getContext("2d")!;
    canvas.width = 512;
    canvas.height = 512;
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillRect(0, 0, 512, 512);

    ctx.beginPath();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "red";
    ctx.rect(0, 0, 512, 512);
    ctx.stroke();

    return new tileLayer.TileCanvas(canvas);
  }

}
