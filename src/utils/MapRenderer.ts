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

  static renderTileOnCanvas(ctx: CanvasRenderingContext2D, fowTile: fogMap.Tile, tileSizeOffset: number, dx: number, dy: number) {
    const CANVAS_BLOCK_SIZE_OFFSET = tileSizeOffset - fogMap.TILE_WIDTH_OFFSET;
    // ctx.strokeRect(dx,dy,1<<tileSizeOffset, 1<<tileSizeOffset);
    if (CANVAS_BLOCK_SIZE_OFFSET < 0) {
      // block is subpixel
      Object.values(fowTile.blocks).forEach(block => {
        const blockDx = dx + (block.x >> -CANVAS_BLOCK_SIZE_OFFSET);
        const blockDy = dy + (block.y >> -CANVAS_BLOCK_SIZE_OFFSET);
        ctx.fillRect(blockDx, blockDy, 1, 1);
      })
    } else {
      Object.values(fowTile.blocks).forEach(block => {
        const blockDx = dx + (block.x << CANVAS_BLOCK_SIZE_OFFSET);
        const blockDy = dy + (block.y << CANVAS_BLOCK_SIZE_OFFSET);
        MapRenderer.renderBlockOnCanvas(ctx, block, CANVAS_BLOCK_SIZE_OFFSET, blockDx, blockDy);
      })
    }
  }

  static renderBlockOnCanvas(ctx: CanvasRenderingContext2D, fowBlock: fogMap.Block, blockSizeOffset: number, dx: number, dy: number) {
    const CANVAS_FOW_PIXEL_SIZE_OFFSET = blockSizeOffset - fogMap.BITMAP_WIDTH_OFFSET;
    for (let x = 0; x < fogMap.BITMAP_WIDTH; x++) {
      for (let y = 0; y < fogMap.BITMAP_WIDTH; y++) {
        if (fowBlock.is_visited(x, y)) {
          // for each pixel of block, we may draw multiple pixel of image
          const overscanOffset = Math.max(CANVAS_FOW_PIXEL_SIZE_OFFSET, 0);
          const underscanOffset = Math.max(-CANVAS_FOW_PIXEL_SIZE_OFFSET, 0);
          ctx.fillRect(
            dx + ((x >> underscanOffset) << overscanOffset),
            dy + ((y >> underscanOffset) << overscanOffset),
            1 << overscanOffset,
            1 << overscanOffset
          );
        }
      }
    }
  }

  private onLoadTileCanvas(tile: tileLayer.Tile) {
    console.log(tile);
    // process tile info
    let canvas = document.createElement("canvas");
    let ctx = canvas.getContext("2d")!;

    const CANVAS_TILE_SIZE_OFFSET = 9;
    const CANVAS_TILE_SIZE = 1 << CANVAS_TILE_SIZE_OFFSET;

    canvas.width = CANVAS_TILE_SIZE;
    canvas.height = CANVAS_TILE_SIZE;
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

      const fowBlockXMin = (tile.x & subTileMask) << (fogMap.TILE_WIDTH_OFFSET - zoomOffset);
      const fowBlockXMax = ((tile.x & subTileMask) + 1) << (fogMap.TILE_WIDTH_OFFSET - zoomOffset);
      const fowBlockYMin = (tile.y & subTileMask) << (fogMap.TILE_WIDTH_OFFSET - zoomOffset);
      const fowBlockYMax = ((tile.y & subTileMask) + 1) << (fogMap.TILE_WIDTH_OFFSET - zoomOffset);

      // TODO: currently we assume a block is at least a pixel, what if a block is subpixel?
      const CANVAS_BLOCK_SIZE_OFFSET = CANVAS_TILE_SIZE_OFFSET - fogMap.TILE_WIDTH_OFFSET + zoomOffset;

      const blocks = this.fogMap.tiles[fogMap.Map.makeKeyXY(fowTileX, fowTileY)]?.blocks;
      if (blocks) {
        Object.values(blocks)
          .filter(block =>
            (block.x >= fowBlockXMin) &&
            (block.x < fowBlockXMax) &&
            (block.y >= fowBlockYMin) &&
            (block.y < fowBlockYMax)
          )
          .forEach(block => {
            const dx = (block.x - fowBlockXMin) << CANVAS_BLOCK_SIZE_OFFSET;
            const dy = (block.y - fowBlockYMin) << CANVAS_BLOCK_SIZE_OFFSET;
            MapRenderer.renderBlockOnCanvas(ctx, block, CANVAS_BLOCK_SIZE_OFFSET, dx, dy);
          })
      }
    } else {
      // render multiple fow tiles
      const CANVAS_NUM_FOW_TILE_OFFSET = FOW_TILE_ZOOM - tile.z;
      const fowTileXMin = tile.x << CANVAS_NUM_FOW_TILE_OFFSET;
      const fowTileXMax = (tile.x + 1) << CANVAS_NUM_FOW_TILE_OFFSET;
      const fowTileYMin = tile.y << CANVAS_NUM_FOW_TILE_OFFSET;
      const fowTileYMax = (tile.y + 1) << CANVAS_NUM_FOW_TILE_OFFSET;
      for (let fowTileX = fowTileXMin; fowTileX < fowTileXMax; fowTileX++) {
        for (let fowTileY = fowTileYMin; fowTileY < fowTileYMax; fowTileY++) {
          const fowTile = this.fogMap.tiles[fogMap.Map.makeKeyXY(fowTileX, fowTileY)];
          if (fowTile) {
            // TODO: what if this < 0?
            const CANVAS_FOW_TILE_SIZE_OFFSET = CANVAS_TILE_SIZE_OFFSET - CANVAS_NUM_FOW_TILE_OFFSET;
            MapRenderer.renderTileOnCanvas(ctx,
              fowTile,
              CANVAS_FOW_TILE_SIZE_OFFSET,
              (fowTileX - fowTileXMin) << CANVAS_FOW_TILE_SIZE_OFFSET,
              (fowTileY - fowTileYMin) << CANVAS_FOW_TILE_SIZE_OFFSET
            );
          }
        }
      }


      console.log(`multi-tile rendering is not implemented`);
    }

    return new tileLayer.TileCanvas(canvas);
  }
}
