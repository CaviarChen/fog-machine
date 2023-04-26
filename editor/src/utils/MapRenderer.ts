import * as deckgl from "./Deckgl";
import * as FogMap from "./FogMap";
import { CANVAS_SIZE_OFFSET, FogCanvas } from "./FogCanvas";

const FOW_TILE_ZOOM = 9;
const FOW_BLOCK_ZOOM = FOW_TILE_ZOOM + FogMap.TILE_WIDTH_OFFSET;

type TileKey = string;
function tileToKey(tile: deckgl.Tile): TileKey {
  return `${tile.index.x}-${tile.index.y}-${tile.index.z}`;
}

// NOTE: this does not handle wraparound
function isBboxOverlap(a: deckgl.Bbox, b: deckgl.Bbox) {
  return (
    a.north >= b.south &&
    b.north >= a.south &&
    a.east >= b.west &&
    b.east >= a.west
  );
}

export class MapRenderer {
  private loadedFogCanvases: { [key: string]: FogCanvas };

  constructor() {
    this.loadedFogCanvases = {};
  }

  onLoadFogCanvas(fogMap: FogMap.FogMap, tile: deckgl.Tile) {
    const fogCanvas = new FogCanvas(tile);
    this.drawFogCanvas(fogMap, fogCanvas);
    this.loadedFogCanvases[tileToKey(tile)] = fogCanvas;
    return fogCanvas;
  }

  onUnloadFogCanvas(tile: deckgl.Tile) {
    delete this.loadedFogCanvases[tileToKey(tile)];
  }

  redrawArea(fogMap: FogMap.FogMap, area: deckgl.Bbox | "all"): void {
    Object.values(this.loadedFogCanvases).forEach((fogCanvas) => {
      if (area === "all" || isBboxOverlap(fogCanvas.tile.bbox, area)) {
        this.drawFogCanvas(fogMap, fogCanvas);
      }
    });
  }

  static renderTileOnCanvas(
    fogCanvas: FogCanvas,
    fowTile: FogMap.Tile,
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
        fogCanvas,
        block,
        CANVAS_FOW_BLOCK_SIZE_OFFSET,
        blockDx,
        blockDy
      );
    });
  }

  static renderBlockOnCanvas(
    fogCanvas: FogCanvas,
    fowBlock: FogMap.Block,
    blockSizeOffset: number,
    dx: number,
    dy: number
  ): void {
    if (blockSizeOffset <= 0) {
      fogCanvas.RedrawContext().clearRect(dx, dy, 1, 1);
    } else {
      const CANVAS_FOW_PIXEL_SIZE_OFFSET =
        blockSizeOffset - FogMap.BITMAP_WIDTH_OFFSET;
      for (let x = 0; x < FogMap.BITMAP_WIDTH; x++) {
        for (let y = 0; y < FogMap.BITMAP_WIDTH; y++) {
          if (fowBlock.isVisited(x, y)) {
            // for each pixel of block, we may draw multiple pixel of image
            const overscanOffset = Math.max(CANVAS_FOW_PIXEL_SIZE_OFFSET, 0);
            const underscanOffset = Math.max(-CANVAS_FOW_PIXEL_SIZE_OFFSET, 0);
            fogCanvas
              .RedrawContext()
              .clearRect(
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

  private drawFogCanvas(fogMap: FogMap.FogMap, fogCanvas: FogCanvas) {
    const tile = fogCanvas.tile;
    fogCanvas.beginRedraw();

    if (Object.values(fogMap.tiles).length === 0) {
      fogCanvas.endRedraw();
      return;
    }

    if (tile.index.z <= FOW_TILE_ZOOM) {
      // render multiple fow tiles
      const CANVAS_NUM_FOW_TILE_OFFSET = FOW_TILE_ZOOM - tile.index.z;
      const fowTileXMin = tile.index.x << CANVAS_NUM_FOW_TILE_OFFSET;
      const fowTileXMax = (tile.index.x + 1) << CANVAS_NUM_FOW_TILE_OFFSET;
      const fowTileYMin = tile.index.y << CANVAS_NUM_FOW_TILE_OFFSET;
      const fowTileYMax = (tile.index.y + 1) << CANVAS_NUM_FOW_TILE_OFFSET;
      for (let fowTileX = fowTileXMin; fowTileX < fowTileXMax; fowTileX++) {
        for (let fowTileY = fowTileYMin; fowTileY < fowTileYMax; fowTileY++) {
          const fowTile =
            fogMap.tiles[FogMap.FogMap.makeKeyXY(fowTileX, fowTileY)];

          if (fowTile) {
            // TODO: what if this < 0?
            const CANVAS_FOW_TILE_SIZE_OFFSET =
              CANVAS_SIZE_OFFSET - CANVAS_NUM_FOW_TILE_OFFSET;
            MapRenderer.renderTileOnCanvas(
              fogCanvas,
              fowTile,
              CANVAS_FOW_TILE_SIZE_OFFSET,
              (fowTileX - fowTileXMin) << CANVAS_FOW_TILE_SIZE_OFFSET,
              (fowTileY - fowTileYMin) << CANVAS_FOW_TILE_SIZE_OFFSET
            );
          }
        }
      }
    } else {
      const TILE_OVER_OFFSET = tile.index.z - FOW_TILE_ZOOM;
      const fowTileX = tile.index.x >> TILE_OVER_OFFSET;
      const fowTileY = tile.index.y >> TILE_OVER_OFFSET;
      const subTileMask = (1 << TILE_OVER_OFFSET) - 1;

      const CANVAS_NUM_FOW_BLOCK_OFFSET =
        FogMap.TILE_WIDTH_OFFSET - TILE_OVER_OFFSET;

      if (tile.index.z > FOW_BLOCK_ZOOM) {
        // sub-block rendering
        const fowBlockX =
          (tile.index.x & subTileMask) >> -CANVAS_NUM_FOW_BLOCK_OFFSET;
        const fowBlockY =
          (tile.index.y & subTileMask) >> -CANVAS_NUM_FOW_BLOCK_OFFSET;
        const subBlockMask =
          (1 << (TILE_OVER_OFFSET - FogMap.TILE_WIDTH_OFFSET)) - 1;

        const CANVAS_NUM_FOW_PIXEL_OFFSET =
          CANVAS_NUM_FOW_BLOCK_OFFSET + FogMap.BITMAP_WIDTH_OFFSET;

        const fowBlockPixelXMin =
          (tile.index.x & subBlockMask) << CANVAS_NUM_FOW_PIXEL_OFFSET;
        const fowBlockPixelXMax =
          ((tile.index.x & subBlockMask) + 1) << CANVAS_NUM_FOW_PIXEL_OFFSET;
        const fowBlockPixelYMin =
          (tile.index.y & subBlockMask) << CANVAS_NUM_FOW_PIXEL_OFFSET;
        const fowBlockPixelYMax =
          ((tile.index.y & subBlockMask) + 1) << CANVAS_NUM_FOW_PIXEL_OFFSET;

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
                fogCanvas
                  .RedrawContext()
                  .clearRect(
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
          (tile.index.x & subTileMask) << CANVAS_NUM_FOW_BLOCK_OFFSET;
        const fowBlockXMax =
          ((tile.index.x & subTileMask) + 1) << CANVAS_NUM_FOW_BLOCK_OFFSET;
        const fowBlockYMin =
          (tile.index.y & subTileMask) << CANVAS_NUM_FOW_BLOCK_OFFSET;
        const fowBlockYMax =
          ((tile.index.y & subTileMask) + 1) << CANVAS_NUM_FOW_BLOCK_OFFSET;

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
                fogCanvas,
                block,
                CANVAS_FOW_BLOCK_SIZE_OFFSET,
                dx,
                dy
              );
            }
          });
        }
      }
    }
    fogCanvas.endRedraw();
  }
}
