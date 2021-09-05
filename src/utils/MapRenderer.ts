import mapboxgl from 'mapbox-gl';
import { BITMAP_WIDTH, FogMap, Tile, TileID, TILE_WIDTH } from './FogMap';

export class MapRenderer {
  private static instance = new MapRenderer();
  private map: mapboxgl.Map | null;
  private fogMap: FogMap;
  private tileCanvases: { [key: TileID]: HTMLCanvasElement };

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

    // SAD: workaround https://github.com/mapbox/mapbox-gl-js/issues/9873              
    let canvas = document.createElement("canvas");
    canvas.width = 13;
    canvas.height = 13;
    this.map.addSource("temp", {
      type: 'canvas',
      canvas: canvas,
      coordinates: [
        [91.4461, 21.5006],
        [100.3541, 21.5006],
        [100.3541, 13.9706],
        [91.4461, 13.9706]
      ]
    });
    this.map.addLayer({
      id: "temp",
      type: 'raster',
      source: "temp",
      paint: {
        'raster-resampling': 'nearest'
      }
    });
    setTimeout(() => {
      if (map !== this.map) return;
      map.removeLayer("temp");
      map.removeSource("temp");
      for (let tileXYKey in this.fogMap.tiles) {
        this.addTileCanvasToMap(this.fogMap.tiles[tileXYKey]);
      }
    }, 200);
  }

  unregisterMap(map: mapboxgl.Map) {
    if (this.map === map) {
      this.map = null;
    }
  }

  addFoGFile(filename: string, data: ArrayBuffer) {
    let newTile = this.fogMap.addFile(filename, data);
    if (newTile) {
      let canvas = document.createElement("canvas");
      let idForMap = `tile${newTile.id}`;
      if (this.tileCanvases[newTile.id]) {
        this.map?.removeLayer(idForMap);
        this.map?.removeSource(idForMap);
      }
      this.tileCanvases[newTile.id] = canvas;
      this.renderTile(newTile);
      this.addTileCanvasToMap(newTile);
    }
  }

  private addTileCanvasToMap(tile: Tile) {
    let idForMap = `tile${tile.id}`;
    let canvas = this.tileCanvases[tile.id];
    this.map?.addSource(idForMap, {
      type: 'canvas',
      canvas: canvas,
      coordinates: tile.bounds()
    });

    this.map?.addLayer({
      id: idForMap,
      type: 'raster',
      source: idForMap,
      paint: {
        'raster-resampling': 'nearest'
      }
    });
  }

  private getFogZoom() {
    if (this.map) {
      return Math.max(2 ** Math.floor(15 - this.map?.getZoom()), 1);
    } else {
      return 1;
    }
  }

  private renderTile(tile: Tile) {
    console.log("rendering tile: ", tile.id);
    let zoom = 512;
    const canvas = this.tileCanvases[tile.id];

    const size = Math.floor(TILE_WIDTH * BITMAP_WIDTH / zoom);

    canvas.width = size;
    canvas.height = size;

    // Set actual size in memory (scaled to account for extra pixel density).
    const scale = window.devicePixelRatio; // Change to 1 on retina screens to see blurry canvas.
    // console.log(`the dpi scale is ${scale}`);
    // scale = 1; // FIXME: recheck whether to enable this
    canvas.width = Math.floor(size * scale);
    canvas.height = Math.floor(size * scale);
    const ctx = canvas.getContext("2d")!;

    ctx.scale(scale, scale);
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

    let blocks = Object.values(tile.blocks);
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

