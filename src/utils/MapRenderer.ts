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
    new tileLayer.TileLayer(map, this.onLoadTileCanvas.bind(this));
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
    // process tile info
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

    if (tile.z === 9) {
      const x = tile.x;
      const y = tile.y;
      const fowTile = this.fogMap.tiles[fogMap.Map.makeKeyXY(x, y)];
      // fowTile?.
      // prepare for the canvas
      if (fowTile) {
        const zoom = fogMap.TILE_WIDTH * fogMap.BITMAP_WIDTH / canvas.width;
        const blocks = Object.values(fowTile.blocks);
        for (let i = 0; i < blocks.length; i++) {
          let block = blocks[i];

          if (zoom >= fogMap.BITMAP_WIDTH) {
            // no need to draw points
            let x = block.x * fogMap.BITMAP_WIDTH;
            let y = block.y * fogMap.BITMAP_WIDTH;
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
            for (let j = 0; j < fogMap.BITMAP_WIDTH; j++) {
              for (let k = 0; k < fogMap.BITMAP_WIDTH; k++) {
                let x = block.x * fogMap.BITMAP_WIDTH + j;
                let y = block.y * fogMap.BITMAP_WIDTH + k;
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
    return new tileLayer.TileCanvas(canvas);
  }
}
