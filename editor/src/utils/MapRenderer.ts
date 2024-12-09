import { Bbox } from "./CommonTypes";
import * as FogMap from "./FogMap";
import mapboxgl from "mapbox-gl";
import { LRUCache } from "lru-cache";

const DEBUG = false;
const FOW_TILE_ZOOM = 9;
const FOW_BLOCK_ZOOM = FOW_TILE_ZOOM + FogMap.TILE_WIDTH_OFFSET;
export const CANVAS_SIZE_OFFSET = 9;
export const CANVAS_SIZE = 1 << CANVAS_SIZE_OFFSET;
export const MAPBOX_MAIN_CANVAS_LAYER = "main-canvas-layer";

// https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
function lngLatToTileXY([lng, lat]: number[], zoom: number): [number, number] {
  const n = Math.pow(2, zoom);
  const latRad = (lat / 180) * Math.PI;
  const x = ((lng + 180.0) / 360.0) * n;
  let y =
    ((1.0 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
      2.0) *
    n;
  // In mapbox globe view, we may get some crazy y coordiates.
  // I guess related to the Mercator projection inflation.
  y = Math.min(Math.max(y, 0), n - 1);

  return [Math.floor(x), Math.floor(y)];
}

function tileXYToLngLat([x, y]: number[], zoom: number): [number, number] {
  const n = Math.pow(2, zoom);
  const lng = (x / n) * 360 - 180;
  const lat =
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  return [lng, lat];
}

function arrayEquals(a: number[], b: number[]) {
  return (
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((val, index) => val === b[index])
  );
}

// A lot of tiles we are drawing are empty. This can help us 1) don't create a
//  canvas when the tile is emtpy. 2) share the same empty tile.
class LazyTileCanvas {
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private opacity: number;

  constructor(opactiy: number) {
    this.opacity = opactiy;
  }

  force(): [HTMLCanvasElement, CanvasRenderingContext2D] {
    if (!this.context) {
      if (!this.canvas) {
        this.canvas = document.createElement("canvas");
        this.context = this.canvas.getContext("2d")!;
        this.canvas.width = 512;
        this.canvas.height = 512;
        this.context.fillStyle =
          "rgba(0, 0, 0," + this.opacity.toString() + ")";
        this.context.fillRect(0, 0, 512, 512);
      } else {
        this.context = this.canvas.getContext("2d")!;
      }
    }
    return [this.canvas!, this.context];
  }

  ctx(): CanvasRenderingContext2D {
    const [_canvas, context] = this.force();
    return context;
  }

  finish() {
    this.context = null;
  }

  getCanvas() {
    return this.canvas;
  }
}

type TileIndexKey = string;

export class TileIndex {
  x: number;
  y: number;
  z: number;

  constructor(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  toKey(): TileIndexKey {
    return `${this.x}-${this.y}-${this.z}`;
  }
}

class Internal {
  private static renderTileOnCanvas(
    fowTile: FogMap.Tile,
    tileCanvas: LazyTileCanvas,
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
      Internal.renderBlockOnCanvas(
        block,
        tileCanvas,
        CANVAS_FOW_BLOCK_SIZE_OFFSET,
        blockDx,
        blockDy
      );
    });
  }

  static renderBlockOnCanvas(
    fowBlock: FogMap.Block,
    tileCanvas: LazyTileCanvas,
    blockSizeOffset: number,
    dx: number,
    dy: number
  ): void {
    if (blockSizeOffset <= 0) {
      tileCanvas.ctx().clearRect(dx, dy, 1, 1);
    } else {
      const CANVAS_FOW_PIXEL_SIZE_OFFSET =
        blockSizeOffset - FogMap.BITMAP_WIDTH_OFFSET;
      for (let x = 0; x < FogMap.BITMAP_WIDTH; x++) {
        for (let y = 0; y < FogMap.BITMAP_WIDTH; y++) {
          if (fowBlock.isVisited(x, y)) {
            // for each pixel of block, we may draw multiple pixel of image
            const overscanOffset = Math.max(CANVAS_FOW_PIXEL_SIZE_OFFSET, 0);
            const underscanOffset = Math.max(-CANVAS_FOW_PIXEL_SIZE_OFFSET, 0);
            tileCanvas
              .ctx()
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

  static drawFogCanvas(
    fogMap: FogMap.FogMap,
    tileIndex: TileIndex,
    opacity: number
  ) {
    const tileCanvas = new LazyTileCanvas(opacity);

    if (Object.values(fogMap.tiles).length === 0) {
      return tileCanvas;
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
            Internal.renderTileOnCanvas(
              fowTile,
              tileCanvas,
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
                tileCanvas
                  .ctx()
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
              Internal.renderBlockOnCanvas(
                block,
                tileCanvas,
                CANVAS_FOW_BLOCK_SIZE_OFFSET,
                dx,
                dy
              );
            }
          });
        }
      }
    }
    tileCanvas.finish();
    return tileCanvas;
  }
}

export class MapRenderer {
  private mapboxMap: mapboxgl.Map;
  private getCurrentFogMap: () => FogMap.FogMap;
  private getCurrentOpacity: () => number;
  private mainCanvas: HTMLCanvasElement;
  private mainCtx: CanvasRenderingContext2D;
  private zoomOffset: number;
  private currentTileRange: [number, number, number, number];
  private currentZoom: number;
  private tileCanvasCache: LRUCache<
    TileIndexKey,
    HTMLCanvasElement | "empty",
    unknown
  >;

  constructor(
    mapboxMap: mapboxgl.Map,
    zoomOffset: number,
    getCurrentFogMap: () => FogMap.FogMap,
    getCurrentOpacity: () => number
  ) {
    this.mapboxMap = mapboxMap;
    this.getCurrentFogMap = getCurrentFogMap;
    this.getCurrentOpacity = getCurrentOpacity;
    this.zoomOffset = zoomOffset;
    this.mainCanvas = document.createElement("canvas");
    this.mainCtx = this.mainCanvas.getContext("2d")!;
    this.currentTileRange = [0, 0, 0, 0];
    this.currentZoom = -1;
    this.tileCanvasCache = new LRUCache({
      max: 200,
      maxSize: 500,
      sizeCalculation: (value, _key) => {
        if (value == "empty") {
          return 1;
        } else {
          return 10;
        }
      },
    });

    this.maybeAddLayer();
    mapboxMap.showTileBoundaries = DEBUG;

    mapboxMap.on("move", () => {
      this.maybeRenderOnce();
    });
    mapboxMap.on("moveend", () => {
      this.maybeRenderOnce();
    });
    mapboxMap.on("styledata", () => {
      // mapbox will remove all layers after `setStyle`.
      this.maybeAddLayer();
    });
  }

  private maybeAddLayer() {
    if (this.mapboxMap.getLayer(MAPBOX_MAIN_CANVAS_LAYER) == undefined) {
      this.mapboxMap.addSource("main-canvas-source", {
        type: "canvas",
        canvas: this.mainCanvas,
        // NOTE: We turn off `animate` and trigger redraw manually for performance reason anyway,
        //  but be aware there is a related bug: https://github.com/mapbox/mapbox-gl-draw/issues/639
        animate: false,
        coordinates: [
          [0, 0],
          [0, 0],
          [0, 0],
          [0, 0],
        ],
      });
      this.mapboxMap.addLayer({
        id: MAPBOX_MAIN_CANVAS_LAYER,
        source: "main-canvas-source",
        type: "raster",
        paint: {
          "raster-fade-duration": 0,
        },
      });
      this.currentZoom = -1;
      this.maybeRenderOnce();
    }
  }

  maybeRenderOnce() {
    if (DEBUG) console.time("[maybeRenderOnce]");

    let zoom = this.mapboxMap.getZoom() + this.zoomOffset;
    zoom = Math.min(Math.max(Math.floor(zoom), 2), 19);
    const bounds = this.mapboxMap.getBounds();

    const [left, top] = lngLatToTileXY(bounds.getNorthWest().toArray(), zoom);
    const [right, bottom] = lngLatToTileXY(
      bounds.getSouthEast().toArray(),
      zoom
    );
    const tileRange: [number, number, number, number] = [
      left,
      top,
      right,
      bottom,
    ];
    if (
      !arrayEquals(this.currentTileRange, tileRange) ||
      this.currentZoom != zoom
    ) {
      this.currentTileRange = tileRange;
      this.currentZoom = zoom;

      this.mainCanvas.width = 512 * (right - left + 1);
      this.mainCanvas.height = 512 * (bottom - top + 1);
      this.renderOnce();
      const tileBounds = new mapboxgl.LngLatBounds(
        tileXYToLngLat([left, bottom + 1], zoom),
        tileXYToLngLat([right + 1, top], zoom)
      );

      const mainCanvasSource = this.mapboxMap.getSource(
        "main-canvas-source"
      ) as mapboxgl.CanvasSource | undefined;
      mainCanvasSource?.setCoordinates([
        tileBounds.getNorthWest().toArray(),
        tileBounds.getNorthEast().toArray(),
        tileBounds.getSouthEast().toArray(),
        tileBounds.getSouthWest().toArray(),
      ]);
    }

    if (DEBUG) console.timeEnd("[maybeRenderOnce]");
  }

  renderOnce() {
    if (DEBUG) console.time("[renderOnce]");

    const zoom = this.currentZoom;
    const [left, top, right, bottom] = this.currentTileRange;
    if (DEBUG) console.log(this.currentZoom, "-", this.currentTileRange);
    this.mainCtx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
    const opacity = this.getCurrentOpacity();
    this.mainCtx.fillStyle = "rgba(0, 0, 0," + opacity.toString() + ")";

    for (let x = left; x <= right; x++) {
      for (let y = top; y <= bottom; y++) {
        const n = Math.pow(2, zoom);
        // y cannot be out of bound
        if (y < 0 || y >= n) continue;
        const yNorm = y;
        // x might be wraparound
        let xNorm = x;
        if (xNorm < 0) xNorm += n;
        if (xNorm >= n) xNorm -= n;

        const tileIndex = new TileIndex(xNorm, yNorm, zoom);
        const key: TileIndexKey = tileIndex.toKey();
        const cacheCanvas = this.tileCanvasCache.get(key);
        let canvas = null;
        if (cacheCanvas) {
          if (cacheCanvas != "empty") {
            canvas = cacheCanvas;
          }
        } else {
          canvas = Internal.drawFogCanvas(
            this.getCurrentFogMap(),
            tileIndex,
            opacity
          ).getCanvas();
          this.tileCanvasCache.set(key, canvas ? canvas : "empty");
        }
        const dx = (x - left) * 512;
        const dy = (y - top) * 512;
        if (canvas) {
          this.mainCtx.drawImage(canvas, dx, dy);
        } else {
          this.mainCtx.fillRect(dx, dy, 512, 512);
        }
      }
    }

    const mainCanvasSource = this.mapboxMap.getSource("main-canvas-source") as
      | mapboxgl.CanvasSource
      | undefined;
    mainCanvasSource?.play();
    mainCanvasSource?.pause();

    if (DEBUG) console.timeEnd("[renderOnce]");
  }

  redrawArea(area: Bbox | "all"): void {
    // TODO: partial redraw?
    const _ = area;
    this.tileCanvasCache.clear();
    this.renderOnce();
  }
}
