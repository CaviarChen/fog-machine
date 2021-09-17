// TODO: consider reactify this?
import mapboxgl from 'mapbox-gl';
import * as fogMap from './FogMap';
import * as tileLayer from './TileLayer';

const FOW_TILE_ZOOM = 9;
const FOW_BLOCK_ZOOM = FOW_TILE_ZOOM + fogMap.TILE_WIDTH_OFFSET;


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

  static genImageDataFromBlockBitmap(bitmap: Uint8Array, sizeOffset: number) {
    // TODO: what if zoomOffset < 0?
    const zoomOffset = fogMap.BITMAP_WIDTH_OFFSET - sizeOffset;
    const imageWidth = 1 << sizeOffset;

    const arr = new Uint8ClampedArray(4 * imageWidth * imageWidth);
    for (let x = 0; x < fogMap.BITMAP_WIDTH; x++) {
      for (let y = 0; y < fogMap.BITMAP_WIDTH; y++) {
        const bit_offset = 7 - x % 8;
        const i = Math.floor(x / 8);
        const j = y;
        if ((bitmap[i + j * 8] & (1 << bit_offset)) !== 0) {
          const i = (((y >> Math.max(zoomOffset,0)) * (imageWidth * 4)) + ((x >> Math.max(zoomOffset,0)) * 4));
          arr[i] = 255; // R Value
          arr[i + 1] = 0; // G Value
          arr[i + 2] = 255; // B Value
          arr[i + 3] = 255; // A Value
        }
      }
    }
    return new ImageData(arr, imageWidth);
  }

  private onLoadTileCanvas(tile: tileLayer.Tile) {
    console.log(tile);
    // process tile info
    let canvas = document.createElement("canvas");
    let ctx = canvas.getContext("2d")!;

    const MAP_TILE_SIZE_OFFSET = 9;
    const MAP_TILE_SIZE = 1 << MAP_TILE_SIZE_OFFSET;

    canvas.width = MAP_TILE_SIZE;
    canvas.height = MAP_TILE_SIZE;
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillRect(0, 0, 512, 512);

    ctx.beginPath();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "red";
    ctx.rect(0, 0, 512, 512);
    ctx.stroke();


    if (tile.z >= FOW_BLOCK_ZOOM) {
      // sub-block rendering
      console.log(`sub-block rendering is not implemented`);
    } else if (tile.z >= FOW_TILE_ZOOM) {
      // sub-tile rendering
      const zoomOffset = tile.z - FOW_TILE_ZOOM;
      const fowTileX = tile.x >> zoomOffset;
      const fowTileY = tile.y >> zoomOffset;
      const subTileMask = (1 << zoomOffset) - 1;

      const fowSubTileX = (tile.x & subTileMask) << (fogMap.TILE_WIDTH_OFFSET - zoomOffset);
      const fowSubTileXUp = ((tile.x & subTileMask) + 1) << (fogMap.TILE_WIDTH_OFFSET - zoomOffset);
      const fowSubTileY = (tile.y & subTileMask) << (fogMap.TILE_WIDTH_OFFSET - zoomOffset);
      const fowSubTileYUp = ((tile.y & subTileMask) + 1) << (fogMap.TILE_WIDTH_OFFSET - zoomOffset);

      // TODO: currently we assume a block is at least a pixel, what if a block is subpixel?
      const CANVAS_BLOCK_SIZE_OFFSET = MAP_TILE_SIZE_OFFSET - fogMap.TILE_WIDTH_OFFSET + zoomOffset;

      const blocks = this.fogMap.tiles[fogMap.Map.makeKeyXY(fowTileX, fowTileY)]?.blocks;
      if (blocks) {
        Object.values(blocks)
          .filter(block =>
            (block.x >= fowSubTileX) &&
            (block.x < fowSubTileXUp) &&
            (block.y >= fowSubTileY) &&
            (block.y < fowSubTileYUp)
          )
          .forEach(block => {
            // do something to render block
            // const sizeOffset = 1;
            const dx = (block.x - fowSubTileX) << CANVAS_BLOCK_SIZE_OFFSET;
            const dy = (block.y - fowSubTileY) << CANVAS_BLOCK_SIZE_OFFSET;
            ctx.putImageData(MapRenderer.genImageDataFromBlockBitmap(block.bitmap, CANVAS_BLOCK_SIZE_OFFSET), dx, dy);
          })
      }
    } else {
      // render multiple fow tiles
      console.log(`multi-tile rendering is not implemented`);
    }

    return new tileLayer.TileCanvas(canvas);
  }
}
