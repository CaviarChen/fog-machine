import mapboxgl from 'mapbox-gl';
import { BITMAP_WIDTH, FogMap, Tile, TileID, TILE_WIDTH } from './FogMap';

export class MapRenderer {
  private static instance = new MapRenderer();
  private map: mapboxgl.Map | null;
  private fogMap: FogMap;
  private tileCanvases: { [key: TileID]: TileCanvas };

  private constructor() {
    this.map = null;
    this.fogMap = new FogMap();
    this.tileCanvases = {};
  }

  static get() {
    return MapRenderer.instance;
  }

  registerMap(map: mapboxgl.Map) {
    this.map = map;

    for (let tileId in this.tileCanvases) {
      this.tileCanvases[tileId].addToMap(map);
    }
  }

  unregisterMap(map: mapboxgl.Map) {
    if (this.map === map) {
      for (let tileId in this.tileCanvases) {
        this.tileCanvases[tileId].removeFromMap(map);
      }
      this.map = null;
    }
  }

  addFoGFile(filename: string, data: ArrayBuffer) {
    let newTile = this.fogMap.addFile(filename, data);
    if (newTile) {
      if (this.map) {
        this.tileCanvases[newTile.id]?.removeFromMap(this.map);
      }
      this.tileCanvases[newTile.id] = new TileCanvas(newTile);
      if (this.map) {
        this.tileCanvases[newTile.id].addToMap(this.map);
      }
    }
  }


  private getFogZoom() {
    if (this.map) {
      return Math.max(2 ** Math.floor(15 - this.map?.getZoom()), 1);
    } else {
      return 1;
    }
  }
}

class TileCanvas {
  private tile: Tile;
  private canvas: HTMLCanvasElement;
  private zoom: number
  private scale: number

  // SAD: TypeScript's analyse is not good enough
  private bounds: number[][] = [];
  private size: number = 0;
  private actualSize: number = 0;

  constructor(tile: Tile) {
    this.tile = tile;
    this.canvas = document.createElement("canvas");

    // Change to 1 on retina screens to see blurry canvas.
    this.scale = window.devicePixelRatio;
    this.zoom = 512;
    this.resize(Math.floor(TILE_WIDTH * BITMAP_WIDTH / this.zoom));
  }

  private resize(size: number) {
    // SAD: workaround https://github.com/mapbox/mapbox-gl-js/issues/9873              
    this.actualSize = Math.floor(size * this.scale + 1);
    this.canvas.width = this.actualSize;
    this.canvas.height = this.actualSize;
    this.bounds = this.tile.bounds(1 / (this.actualSize - 1));
  }

  addToMap(map: mapboxgl.Map) {
    let idForMap = `tile${this.tile.id}`;
    map.addSource(idForMap, {
      type: 'canvas',
      canvas: this.canvas,
      coordinates: this.bounds
    });

    map.addLayer({
      id: idForMap,
      type: 'raster',
      source: idForMap,
      paint: {
        'raster-resampling': 'nearest'
      }
    });

    this.render();
  }

  removeFromMap(map: mapboxgl.Map) {
    let idForMap = `tile${this.tile.id}`;
    map.removeLayer(idForMap);
    map.removeSource(idForMap);
  }

  private render() {
    console.log("rendering tile: ", this.tile.id);
    let zoom = 512;



    // console.log(`the dpi scale is ${scale}`);
    // scale = 1; // FIXME: recheck whether to enable this
    const ctx = this.canvas.getContext("2d")!;

    ctx.scale(this.scale, this.scale);
    // console.log(`CANVAS SIZE IS ${size}`);
    // ctx.clearRect(0,0,50,50);
    ctx.fillStyle = "#000000";
    // draw grid for tile
    // ctx.strokeRect(0, 0, size, size);
    // ctx.strokeRect(0, 0, size/2, size/2);

    // // draw id/filename of tile
    // ctx.fillStyle = "#FFFFFF";
    // ctx.fillRect(10, 10, 350, 50);
    // ctx.fillStyle = "#000000";
    // ctx.font = "24px serif";
    // ctx.fillText(`${this.id}/${this.filename}`, 15, 40);

    let blocks = Object.values(this.tile.blocks);
    for (let i = 0; i < blocks.length; i++) {
      let block = blocks[i];

      if (zoom >= BITMAP_WIDTH) {
        // no need to draw points
        let x = block.x * BITMAP_WIDTH;
        let y = block.y * BITMAP_WIDTH;
        x = Math.floor(x / zoom);
        y = Math.floor(y / zoom);
        ctx.fillRect(x, y, 1, 1);
      } else {
        // draw grid for block
        // ctx.strokeRect(Math.floor(block.x * BITMAP_WIDTH / zoom),
        //     Math.floor(block.y * BITMAP_WIDTH / zoom),
        //     Math.floor(BITMAP_WIDTH / zoom),
        //     Math.floor(BITMAP_WIDTH / zoom)
        // );
        for (let j = 0; j < BITMAP_WIDTH; j++) {
          for (let k = 0; k < BITMAP_WIDTH; k++) {
            let x = block.x * BITMAP_WIDTH + j;
            let y = block.y * BITMAP_WIDTH + k;
            x = Math.floor(x / zoom);
            y = Math.floor(y / zoom);
            if (block.is_visited(j, k)) {
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }
      }
    }
  }
}