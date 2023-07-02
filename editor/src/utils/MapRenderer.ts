import * as deckgl from "./Deckgl";
import * as FogMap from "./FogMap";
import { CANVAS_SIZE_OFFSET, FogCanvas } from "./FogCanvas";

const FOW_TILE_ZOOM = 9;
const FOW_BLOCK_ZOOM = FOW_TILE_ZOOM + FogMap.TILE_WIDTH_OFFSET;

type TileKey = string;
// function tileToKey(tile: deckgl.Tile): TileKey {
//   return `${tileIndex.x}-${tileIndex.y}-${tileIndex.z}`;
// }

// NOTE: this does not handle wraparound
function isBboxOverlap(a: deckgl.Bbox, b: deckgl.Bbox) {
  return (
    a.north >= b.south &&
    b.north >= a.south &&
    a.east >= b.west &&
    b.east >= a.west
  );
}

export class TileIndex {
  x: number;
  y: number;
  z: number;

  constructor(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}


export class MapRenderer {
  private loadedFogCanvases: { [key: string]: FogCanvas };

  constructor() {
    this.loadedFogCanvases = {};
  }

  onLoadFogCanvas(fogMap: FogMap.FogMap, tile: deckgl.Tile) {
    const fogCanvas = new FogCanvas(tile);
    // this.drawFogCanvas(fogMap, fogCanvas);
    // this.loadedFogCanvases[tileToKey(tile)] = fogCanvas;
    return fogCanvas;
  }

  onUnloadFogCanvas(tile: deckgl.Tile) {
    // delete this.loadedFogCanvases[tileToKey(tile)];
  }

  redrawArea(fogMap: FogMap.FogMap, area: deckgl.Bbox | "all"): void {
    // Object.values(this.loadedFogCanvases).forEach((fogCanvas) => {
    //   if (area === "all" || isBboxOverlap(fogCanvas.tile.bbox, area)) {
    //     this.drawFogCanvas(fogMap, fogCanvas);
    //   }
    // });
  }

  static renderTileOnCanvas(
    fowTile: FogMap.Tile,
    ctx: CanvasRenderingContext2D,
    tileSizeOffset: number,
    dx: number,
    dy: number
  ): void {
    const CANVAS_FOW_BLOCK_SIZE_OFFSET =
      tileSizeOffset - FogMap.TILE_WIDTH_OFFSET;
    // ctx.strokeRect(dx,dy,1<<tileSizeOffset, 1<<tileSizeOffset);
    const overscanOffset = Math.max(CANVAS_FOW_BLOCK_SIZE_OFFSET, 0);
    const underscanOffset = Math.max(-CANVAS_FOW_BLOCK_SIZE_OFFSET, 0);
    Object.values(fowTile.blocks).forEach((block) => {
      const blockDx = dx + ((block.x >> underscanOffset) << overscanOffset);
      const blockDy = dy + ((block.y >> underscanOffset) << overscanOffset);
      MapRenderer.renderBlockOnCanvas(
        block,
        ctx,
        CANVAS_FOW_BLOCK_SIZE_OFFSET,
        blockDx,
        blockDy
      );
    });
  }

  static renderBlockOnCanvas(
    fowBlock: FogMap.Block,
    ctx: CanvasRenderingContext2D,
    blockSizeOffset: number,
    dx: number,
    dy: number
  ): void {
    if (blockSizeOffset <= 0) {
      ctx.clearRect(dx, dy, 1, 1);
    } else {
      const CANVAS_FOW_PIXEL_SIZE_OFFSET =
        blockSizeOffset - FogMap.BITMAP_WIDTH_OFFSET;
      for (let x = 0; x < FogMap.BITMAP_WIDTH; x++) {
        for (let y = 0; y < FogMap.BITMAP_WIDTH; y++) {
          if (fowBlock.isVisited(x, y)) {
            // for each pixel of block, we may draw multiple pixel of image
            const overscanOffset = Math.max(CANVAS_FOW_PIXEL_SIZE_OFFSET, 0);
            const underscanOffset = Math.max(-CANVAS_FOW_PIXEL_SIZE_OFFSET, 0);
            ctx.clearRect(
              dx + ((x >> underscanOffset) << overscanOffset),
              dy + ((y >> underscanOffset) << overscanOffset),
              1 << overscanOffset,
              1 << overscanOffset
            );
          }
        }
      }
    }
  }

  static drawFogCanvas(fogMap: FogMap.FogMap, tileIndex: TileIndex) {

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = 512;
    canvas.height = 512;
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, 512, 512);


    if (Object.values(fogMap.tiles).length === 0) {
      return canvas;
    }

    if (tileIndex.z <= FOW_TILE_ZOOM) {
      // render multiple fow tiles
      const CANVAS_NUM_FOW_TILE_OFFSET = FOW_TILE_ZOOM - tileIndex.z;
      const fowTileXMin = tileIndex.x << CANVAS_NUM_FOW_TILE_OFFSET;
      const fowTileXMax = (tileIndex.x + 1) << CANVAS_NUM_FOW_TILE_OFFSET;
      const fowTileYMin = tileIndex.y << CANVAS_NUM_FOW_TILE_OFFSET;
      const fowTileYMax = (tileIndex.y + 1) << CANVAS_NUM_FOW_TILE_OFFSET;
      for (let fowTileX = fowTileXMin; fowTileX < fowTileXMax; fowTileX++) {
        for (let fowTileY = fowTileYMin; fowTileY < fowTileYMax; fowTileY++) {
          const fowTile =
            fogMap.tiles[FogMap.FogMap.makeKeyXY(fowTileX, fowTileY)];

          if (fowTile) {
            // TODO: what if this < 0?
            const CANVAS_FOW_TILE_SIZE_OFFSET =
              CANVAS_SIZE_OFFSET - CANVAS_NUM_FOW_TILE_OFFSET;
            MapRenderer.renderTileOnCanvas(
              fowTile,
              ctx,
              CANVAS_FOW_TILE_SIZE_OFFSET,
              (fowTileX - fowTileXMin) << CANVAS_FOW_TILE_SIZE_OFFSET,
              (fowTileY - fowTileYMin) << CANVAS_FOW_TILE_SIZE_OFFSET
            );
          }
        }
      }
    } else {
      const TILE_OVER_OFFSET = tileIndex.z - FOW_TILE_ZOOM;
      const fowTileX = tileIndex.x >> TILE_OVER_OFFSET;
      const fowTileY = tileIndex.y >> TILE_OVER_OFFSET;
      const subTileMask = (1 << TILE_OVER_OFFSET) - 1;

      const CANVAS_NUM_FOW_BLOCK_OFFSET =
        FogMap.TILE_WIDTH_OFFSET - TILE_OVER_OFFSET;

      if (tileIndex.z > FOW_BLOCK_ZOOM) {
        // sub-block rendering
        const fowBlockX =
          (tileIndex.x & subTileMask) >> -CANVAS_NUM_FOW_BLOCK_OFFSET;
        const fowBlockY =
          (tileIndex.y & subTileMask) >> -CANVAS_NUM_FOW_BLOCK_OFFSET;
        const subBlockMask =
          (1 << (TILE_OVER_OFFSET - FogMap.TILE_WIDTH_OFFSET)) - 1;

        const CANVAS_NUM_FOW_PIXEL_OFFSET =
          CANVAS_NUM_FOW_BLOCK_OFFSET + FogMap.BITMAP_WIDTH_OFFSET;

        const fowBlockPixelXMin =
          (tileIndex.x & subBlockMask) << CANVAS_NUM_FOW_PIXEL_OFFSET;
        const fowBlockPixelXMax =
          ((tileIndex.x & subBlockMask) + 1) << CANVAS_NUM_FOW_PIXEL_OFFSET;
        const fowBlockPixelYMin =
          (tileIndex.y & subBlockMask) << CANVAS_NUM_FOW_PIXEL_OFFSET;
        const fowBlockPixelYMax =
          ((tileIndex.y & subBlockMask) + 1) << CANVAS_NUM_FOW_PIXEL_OFFSET;

        const block =
          fogMap.tiles[FogMap.FogMap.makeKeyXY(fowTileX, fowTileY)]?.blocks[
          FogMap.FogMap.makeKeyXY(fowBlockX, fowBlockY)
          ];

        if (block) {
          for (
            let fowPixelX = fowBlockPixelXMin;
            fowPixelX < fowBlockPixelXMax;
            fowPixelX++
          ) {
            for (
              let fowPixelY = fowBlockPixelYMin;
              fowPixelY < fowBlockPixelYMax;
              fowPixelY++
            ) {
              const CANVAS_FOW_PIXEL_SIZE_OFFSET =
                CANVAS_SIZE_OFFSET - CANVAS_NUM_FOW_PIXEL_OFFSET;
              if (block.isVisited(fowPixelX, fowPixelY)) {
                const x =
                  (fowPixelX - fowBlockPixelXMin) <<
                  CANVAS_FOW_PIXEL_SIZE_OFFSET;
                const y =
                  (fowPixelY - fowBlockPixelYMin) <<
                  CANVAS_FOW_PIXEL_SIZE_OFFSET;
                ctx.clearRect(
                  x,
                  y,
                  1 << CANVAS_FOW_PIXEL_SIZE_OFFSET,
                  1 << CANVAS_FOW_PIXEL_SIZE_OFFSET
                );
              }
            }
          }
        }
      } else {
        // sub-tile rendering
        const fowBlockXMin =
          (tileIndex.x & subTileMask) << CANVAS_NUM_FOW_BLOCK_OFFSET;
        const fowBlockXMax =
          ((tileIndex.x & subTileMask) + 1) << CANVAS_NUM_FOW_BLOCK_OFFSET;
        const fowBlockYMin =
          (tileIndex.y & subTileMask) << CANVAS_NUM_FOW_BLOCK_OFFSET;
        const fowBlockYMax =
          ((tileIndex.y & subTileMask) + 1) << CANVAS_NUM_FOW_BLOCK_OFFSET;

        const CANVAS_FOW_BLOCK_SIZE_OFFSET =
          CANVAS_SIZE_OFFSET - CANVAS_NUM_FOW_BLOCK_OFFSET;

        const blocks =
          fogMap.tiles[FogMap.FogMap.makeKeyXY(fowTileX, fowTileY)]?.blocks;
        if (blocks) {
          Object.values(blocks).forEach((block) => {
            if (
              block.x >= fowBlockXMin &&
              block.x < fowBlockXMax &&
              block.y >= fowBlockYMin &&
              block.y < fowBlockYMax
            ) {
              const dx =
                (block.x - fowBlockXMin) << CANVAS_FOW_BLOCK_SIZE_OFFSET;
              const dy =
                (block.y - fowBlockYMin) << CANVAS_FOW_BLOCK_SIZE_OFFSET;
              MapRenderer.renderBlockOnCanvas(
                block,
                ctx,
                CANVAS_FOW_BLOCK_SIZE_OFFSET,
                dx,
                dy
              );
            }
          });
        }
      }
    }

    return canvas;
  }
}
