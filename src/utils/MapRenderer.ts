// TODO: consider reactify this?
import mapboxgl from "mapbox-gl";
import * as fogMap from "./FogMap";
import * as deckgl from "./Deckgl";

const FOW_TILE_ZOOM = 9;
const FOW_BLOCK_ZOOM = FOW_TILE_ZOOM + fogMap.TILE_WIDTH_OFFSET;
const CANVAS_SIZE_OFFSET = 9;
const CANVAS_SIZE = 1 << CANVAS_SIZE_OFFSET;

type TileKey = string;

function tileToKey(tile: deckgl.Tile): TileKey {
  return `${tile.x}-${tile.y}-${tile.z}`;
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
  private static instance = new MapRenderer();
  private map: mapboxgl.Map | null;
  private deckgl: deckgl.Deckgl | null;
  public fogMap: fogMap.Map;
  private loadedTileCanvases: { [key: string]: deckgl.TileCanvas };
  private eraserMode: boolean;
  private eraserArea: [mapboxgl.LngLat, mapboxgl.GeoJSONSource] | null;

  private constructor() {
    this.map = null;
    this.deckgl = null;
    this.fogMap = new fogMap.Map();
    this.loadedTileCanvases = {};
    this.eraserMode = false;
    this.eraserArea = null;
  }

  static get(): MapRenderer {
    return MapRenderer.instance;
  }

  registerMap(map: mapboxgl.Map, deckglContainer: HTMLCanvasElement): void {
    this.map = map;
    this.deckgl = new deckgl.Deckgl(
      map,
      deckglContainer,
      this.onLoadTileCanvas.bind(this),
      this.onUnloadTileCanvas.bind(this)
    );
    this.map.on("mousedown", this.handleMouseClick.bind(this));
    this.map.on("mouseup", this.handleMouseRelease.bind(this));
    this.map.on("mousemove", this.handleMouseMove.bind(this));
    this.setEraserMod(this.eraserMode);
  }

  unregisterMap(_map: mapboxgl.Map): void {
    // TODO
  }

  private redrawArea(area: deckgl.Bbox): void {
    Object.values(this.loadedTileCanvases).forEach((tileCanvas) => {
      if (isBboxOverlap(tileCanvas.tile.bbox, area)) {
        this.drawTileCanvas(tileCanvas);
      }
    });
  }

  addFoGFile(filename: string, data: ArrayBuffer): void {
    const newTile = this.fogMap.addFile(filename, data);
    if (newTile) {
      this.redrawArea(newTile.bbox());
    }
  }

  handleMouseClick(e: mapboxgl.MapMouseEvent): void {
    if (this.eraserMode) {
      console.log(
        `A click event has occurred on a visible portion of the poi-label layer at ${e.lngLat}`
      );

      if (!this.eraserArea) {
        this.map?.addSource("eraser", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [[]],
            },
          },
        });

        this.map?.addLayer({
          id: "eraser",
          type: "fill",
          source: "eraser",
          layout: {},
          paint: {
            "fill-color": "#969696",
            "fill-opacity": 0.5,
          },
        });
        this.map?.addLayer({
          id: "eraser-outline",
          type: "line",
          source: "eraser",
          layout: {},
          paint: {
            "line-color": "#969696",
            "line-width": 1,
          },
        });

        const eraserSource = this.map?.getSource(
          "eraser"
        ) as mapboxgl.GeoJSONSource | null;
        if (eraserSource) {
          const startPoint = new mapboxgl.LngLat(e.lngLat.lng, e.lngLat.lat);
          this.eraserArea = [startPoint, eraserSource];
        }
      }
    }
  }

  handleMouseMove(e: mapboxgl.MapMouseEvent): void {
    if (this.eraserMode && this.eraserArea) {
      const [startPoint, eraserSource] = this.eraserArea;
      const west = Math.min(e.lngLat.lng, startPoint.lng);
      const north = Math.max(e.lngLat.lat, startPoint.lat);
      const east = Math.max(e.lngLat.lng, startPoint.lng);
      const south = Math.min(e.lngLat.lat, startPoint.lat);

      eraserSource.setData({
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [east, north],
              [west, north],
              [west, south],
              [east, south],
              [east, north],
            ],
          ],
        },
      });
    }
  }

  handleMouseRelease(e: mapboxgl.MapMouseEvent): void {
    if (this.eraserMode && this.eraserArea) {
      const startPoint = this.eraserArea[0];
      const west = Math.min(e.lngLat.lng, startPoint.lng);
      const north = Math.max(e.lngLat.lat, startPoint.lat);
      const east = Math.max(e.lngLat.lng, startPoint.lng);
      const south = Math.min(e.lngLat.lat, startPoint.lat);

      this.map?.removeLayer("eraser");
      this.map?.removeLayer("eraser-outline");
      this.map?.removeSource("eraser");

      const bbox = new deckgl.Bbox(west, south, east, north);
      console.log(`clearing the bbox ${west} ${north} ${east} ${south}`);

      this.fogMap.clearBbox(bbox);
      this.redrawArea(bbox);

      this.eraserArea = null;
    }
  }

  setEraserMod(isActivated: boolean): void {
    this.eraserMode = isActivated;
    const mapboxCanvas = this.map?.getCanvasContainer();
    if (!mapboxCanvas) {
      return;
    }
    if (this.eraserMode) {
      mapboxCanvas.style.cursor = "cell";
      this.map?.dragPan.disable();
    } else {
      mapboxCanvas.style.cursor = "";
      this.map?.dragPan.enable();
      if (this.eraserArea) {
        this.map?.removeLayer("eraser");
        this.map?.removeLayer("eraser-outline");
        this.map?.removeSource("eraser");
        this.eraserArea = null;
      }
    }
  }

  static renderTileOnCanvas(
    ctx: CanvasRenderingContext2D,
    fowTile: fogMap.Tile,
    tileSizeOffset: number,
    dx: number,
    dy: number
  ): void {
    const CANVAS_FOW_BLOCK_SIZE_OFFSET =
      tileSizeOffset - fogMap.TILE_WIDTH_OFFSET;
    // ctx.strokeRect(dx,dy,1<<tileSizeOffset, 1<<tileSizeOffset);
    const overscanOffset = Math.max(CANVAS_FOW_BLOCK_SIZE_OFFSET, 0);
    const underscanOffset = Math.max(-CANVAS_FOW_BLOCK_SIZE_OFFSET, 0);
    Object.values(fowTile.blocks).forEach((block) => {
      const blockDx = dx + ((block.x >> underscanOffset) << overscanOffset);
      const blockDy = dy + ((block.y >> underscanOffset) << overscanOffset);
      MapRenderer.renderBlockOnCanvas(
        ctx,
        block,
        CANVAS_FOW_BLOCK_SIZE_OFFSET,
        blockDx,
        blockDy
      );
    });
  }

  static renderBlockOnCanvas(
    ctx: CanvasRenderingContext2D,
    fowBlock: fogMap.Block,
    blockSizeOffset: number,
    dx: number,
    dy: number
  ): void {
    if (blockSizeOffset <= 0) {
      ctx.clearRect(dx, dy, 1, 1);
    } else {
      const CANVAS_FOW_PIXEL_SIZE_OFFSET =
        blockSizeOffset - fogMap.BITMAP_WIDTH_OFFSET;
      for (let x = 0; x < fogMap.BITMAP_WIDTH; x++) {
        for (let y = 0; y < fogMap.BITMAP_WIDTH; y++) {
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

  private drawTileCanvas(tileCanvas: deckgl.TileCanvas) {
    const tile = tileCanvas.tile;
    const canvas = tileCanvas.canvas;
    const ctx = canvas.getContext("2d")!;

    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;

    ctx.fillStyle = "rgba(0, 0, 0, 1)";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    if (tile.z <= FOW_TILE_ZOOM) {
      // render multiple fow tiles
      const CANVAS_NUM_FOW_TILE_OFFSET = FOW_TILE_ZOOM - tile.z;
      const fowTileXMin = tile.x << CANVAS_NUM_FOW_TILE_OFFSET;
      const fowTileXMax = (tile.x + 1) << CANVAS_NUM_FOW_TILE_OFFSET;
      const fowTileYMin = tile.y << CANVAS_NUM_FOW_TILE_OFFSET;
      const fowTileYMax = (tile.y + 1) << CANVAS_NUM_FOW_TILE_OFFSET;
      for (let fowTileX = fowTileXMin; fowTileX < fowTileXMax; fowTileX++) {
        for (let fowTileY = fowTileYMin; fowTileY < fowTileYMax; fowTileY++) {
          const fowTile =
            this.fogMap.tiles[fogMap.Map.makeKeyXY(fowTileX, fowTileY)];
          if (fowTile) {
            // TODO: what if this < 0?
            const CANVAS_FOW_TILE_SIZE_OFFSET =
              CANVAS_SIZE_OFFSET - CANVAS_NUM_FOW_TILE_OFFSET;
            MapRenderer.renderTileOnCanvas(
              ctx,
              fowTile,
              CANVAS_FOW_TILE_SIZE_OFFSET,
              (fowTileX - fowTileXMin) << CANVAS_FOW_TILE_SIZE_OFFSET,
              (fowTileY - fowTileYMin) << CANVAS_FOW_TILE_SIZE_OFFSET
            );
          }
        }
      }
    } else {
      const TILE_OVER_OFFSET = tile.z - FOW_TILE_ZOOM;
      const fowTileX = tile.x >> TILE_OVER_OFFSET;
      const fowTileY = tile.y >> TILE_OVER_OFFSET;
      const subTileMask = (1 << TILE_OVER_OFFSET) - 1;

      const CANVAS_NUM_FOW_BLOCK_OFFSET =
        fogMap.TILE_WIDTH_OFFSET - TILE_OVER_OFFSET;

      if (tile.z > FOW_BLOCK_ZOOM) {
        // sub-block rendering
        const fowBlockX =
          (tile.x & subTileMask) >> -CANVAS_NUM_FOW_BLOCK_OFFSET;
        const fowBlockY =
          (tile.y & subTileMask) >> -CANVAS_NUM_FOW_BLOCK_OFFSET;
        const subBlockMask =
          (1 << (TILE_OVER_OFFSET - fogMap.TILE_WIDTH_OFFSET)) - 1;

        const CANVAS_NUM_FOW_PIXEL_OFFSET =
          CANVAS_NUM_FOW_BLOCK_OFFSET + fogMap.BITMAP_WIDTH_OFFSET;

        const fowBlockPixelXMin =
          (tile.x & subBlockMask) << CANVAS_NUM_FOW_PIXEL_OFFSET;
        const fowBlockPixelXMax =
          ((tile.x & subBlockMask) + 1) << CANVAS_NUM_FOW_PIXEL_OFFSET;
        const fowBlockPixelYMin =
          (tile.y & subBlockMask) << CANVAS_NUM_FOW_PIXEL_OFFSET;
        const fowBlockPixelYMax =
          ((tile.y & subBlockMask) + 1) << CANVAS_NUM_FOW_PIXEL_OFFSET;

        const block =
          this.fogMap.tiles[fogMap.Map.makeKeyXY(fowTileX, fowTileY)]?.blocks[
            fogMap.Map.makeKeyXY(fowBlockX, fowBlockY)
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
          (tile.x & subTileMask) << CANVAS_NUM_FOW_BLOCK_OFFSET;
        const fowBlockXMax =
          ((tile.x & subTileMask) + 1) << CANVAS_NUM_FOW_BLOCK_OFFSET;
        const fowBlockYMin =
          (tile.y & subTileMask) << CANVAS_NUM_FOW_BLOCK_OFFSET;
        const fowBlockYMax =
          ((tile.y & subTileMask) + 1) << CANVAS_NUM_FOW_BLOCK_OFFSET;

        const CANVAS_FOW_BLOCK_SIZE_OFFSET =
          CANVAS_SIZE_OFFSET - CANVAS_NUM_FOW_BLOCK_OFFSET;

        const blocks =
          this.fogMap.tiles[fogMap.Map.makeKeyXY(fowTileX, fowTileY)]?.blocks;
        if (blocks) {
          Object.values(blocks)
            .filter(
              (block) =>
                block.x >= fowBlockXMin &&
                block.x < fowBlockXMax &&
                block.y >= fowBlockYMin &&
                block.y < fowBlockYMax
            )
            .forEach((block) => {
              const dx =
                (block.x - fowBlockXMin) << CANVAS_FOW_BLOCK_SIZE_OFFSET;
              const dy =
                (block.y - fowBlockYMin) << CANVAS_FOW_BLOCK_SIZE_OFFSET;
              MapRenderer.renderBlockOnCanvas(
                ctx,
                block,
                CANVAS_FOW_BLOCK_SIZE_OFFSET,
                dx,
                dy
              );
            });
        }
      }
    }
    tileCanvas.updateOnce();
  }

  private onLoadTileCanvas(tile: deckgl.Tile, tileCanvas: deckgl.TileCanvas) {
    this.drawTileCanvas(tileCanvas);
    this.loadedTileCanvases[tileToKey(tile)] = tileCanvas;
    return tileCanvas;
  }

  private onUnloadTileCanvas(tile: deckgl.Tile) {
    delete this.loadedTileCanvases[tileToKey(tile)];
  }
}
