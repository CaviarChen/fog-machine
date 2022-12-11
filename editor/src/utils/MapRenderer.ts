// need typed definitions from @mapbox/mapbox-gl-draw
/* eslint-disable */
// @ts-nocheck
// TODO: consider reactify this?
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import * as fogMap from "./FogMap";
import * as deckgl from "./Deckgl";
import { CANVAS_SIZE_OFFSET, FogCanvas } from "./FogCanvas";
import { HistoryManager } from "./HistoryManager";

const FOW_TILE_ZOOM = 9;
const FOW_BLOCK_ZOOM = FOW_TILE_ZOOM + fogMap.TILE_WIDTH_OFFSET;

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

export enum ControlMode {
  View,
  Eraser,
  DrawLine,
}

export class MapRenderer {
  private static instance: MapRenderer | null = null;
  private map: mapboxgl.Map | null;
  private deckgl: deckgl.Deckgl | null;
  public fogMap: fogMap.FogMap;
  public historyManager: HistoryManager;
  private loadedFogCanvases: { [key: string]: FogCanvas };
  private controlMode: ControlMode;
  private lineMode: boolean;
  private eraserArea: [mapboxgl.LngLat, mapboxgl.GeoJSONSource] | null;
  private mapglDraw: MapboxDraw;
  private onChangeCallback: { [key: string]: () => void };

  private constructor() {
    this.map = null;
    this.deckgl = null;
    this.fogMap = fogMap.FogMap.empty;
    this.loadedFogCanvases = {};
    this.controlMode = ControlMode.View;
    this.lineMode = false;
    this.eraserArea = null;
    this.mapglDraw = new MapboxDraw({
      displayControlsDefault: false,
      defaultMode: "draw_line_string",
      styles: [
        // ACTIVE (being drawn)
        // line stroke
        {
          id: "gl-draw-line",
          type: "line",
          filter: [
            "all",
            ["==", "$type", "LineString"],
            ["!=", "mode", "static"],
          ],
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#969696",
            "line-dasharray": [0.2, 2],
            "line-width": 2,
          },
        },
      ],
    });
    this.historyManager = new HistoryManager(this.fogMap);
    this.onChangeCallback = {};
  }

  static create(): MapRenderer {
    if (MapRenderer.instance) {
      console.log(
        "WARNING: One shouldn't create a second copy of `MapRenderer`"
      );
    } else {
      MapRenderer.instance = new MapRenderer();
    }
    return MapRenderer.instance;
  }

  private onChange() {
    Object.keys(this.onChangeCallback).map((key) => {
      const callback = this.onChangeCallback[key];
      callback();
    });
  }

  registerMap(map: mapboxgl.Map, deckglContainer: HTMLCanvasElement): void {
    this.map = map;
    this.deckgl = new deckgl.Deckgl(
      map,
      deckglContainer,
      this.onLoadFogCanvas.bind(this),
      this.onUnloadFogCanvas.bind(this)
    );
    this.map.on("mousedown", this.handleMouseClick.bind(this));
    this.map.on("mouseup", this.handleMouseRelease.bind(this));
    this.map.on("mousemove", this.handleMouseMove.bind(this));
    this.map.on("draw.create", this.handleDrawComplete.bind(this));
    this.map.on("draw.modechange", (ev) => {
      this.mapglDraw.changeMode("draw_line_string", {});
    });
    this.setControlMode(this.controlMode);
    this.onChange();
  }

  unregisterMap(_map: mapboxgl.Map): void {
    // TODO
  }

  registerOnChangeCallback(key: string, callback: () => void) {
    this.onChangeCallback[key] = callback;
    this.onChange();
  }

  unregisterOnChangeCallback(key: string) {
    delete this.onChangeCallback[key];
  }

  redrawArea(area: deckgl.Bbox | "all"): void {
    Object.values(this.loadedFogCanvases).forEach((fogCanvas) => {
      if (area === "all" || isBboxOverlap(fogCanvas.tile.bbox, area)) {
        this.drawFogCanvas(fogCanvas);
      }
    });
    this.deckgl?.updateOnce();
  }

  private applyFogMapUpdate(
    newMap: fogMap.FogMap,
    areaChanged: deckgl.Bbox | "all"
  ) {
    this.fogMap = newMap;
    this.redrawArea(areaChanged);

    if (this.onChange) {
      this.onChange();
    }
  }

  private updateFogMap(
    newMap: fogMap.FogMap,
    areaChanged: deckgl.Bbox | "all"
  ): void {
    if (this.fogMap !== newMap) {
      this.historyManager.append(newMap, areaChanged);
      this.applyFogMapUpdate(newMap, areaChanged);
    }
  }

  replaceFogMap(newMap: fogMap.FogMap): void {
    this.historyManager = new HistoryManager(fogMap.FogMap.empty);
    this.updateFogMap(newMap, "all");
  }

  undo(): void {
    this.historyManager.undo(this.applyFogMapUpdate.bind(this));
  }

  redo(): void {
    this.historyManager.redo(this.applyFogMapUpdate.bind(this));
  }

  handleMouseClick(e: mapboxgl.MapMouseEvent): void {
    if (this.controlMode === ControlMode.Eraser) {
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
    if (this.controlMode === ControlMode.Eraser && this.eraserArea) {
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
    if (this.controlMode === ControlMode.Eraser && this.eraserArea) {
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

      const newMap = this.fogMap.clearBbox(bbox);
      this.updateFogMap(newMap, bbox);

      this.eraserArea = null;
    }
  }

  handleDrawComplete(e: GeoJSON): void {
    // parse each line segments, apply to fogmap
    console.log(e.features);
    for (const geo of e.features) {
      if (geo.geometry.type == "LineString") {
        const coordinates = geo.geometry.coordinates;

        let [startLng, startLat] = coordinates[0];
        let newMap = this.fogMap;
        const bounds = new mapboxgl.LngLatBounds(
          coordinates[0],
          coordinates[0]
        );
        for (let j = 1; j < coordinates.length; ++j) {
          const [endLng, endLat] = coordinates[j];
          newMap = newMap.addLine(startLng, startLat, endLng, endLat);
          bounds.extend(coordinates[j]);
          [startLng, startLat] = [endLng, endLat];
        }
        const bbox = new deckgl.Bbox(
          bounds.getWest(),
          bounds.getSouth(),
          bounds.getEast(),
          bounds.getNorth()
        );
        this.updateFogMap(newMap, bbox);
      }
    }
    this.mapglDraw.trash(); // clean up the user drawing
  }

  setControlMode(mode: ControlMode): void {
    const mapboxCanvas = this.map?.getCanvasContainer();
    if (!mapboxCanvas) {
      return;
    }

    // disable the current active mode
    switch (this.controlMode) {
      case ControlMode.View:
        break;
      case ControlMode.Eraser:
        mapboxCanvas.style.cursor = "";
        this.map?.dragPan.enable();
        if (this.eraserArea) {
          this.map?.removeLayer("eraser");
          this.map?.removeLayer("eraser-outline");
          this.map?.removeSource("eraser");
          this.eraserArea = null;
        }
        break;
      case ControlMode.DrawLine:
        mapboxCanvas.style.cursor = "";
        this.map?.dragPan.enable();
        if (this.map?.hasControl(this.mapglDraw)) {
          this.map?.removeControl(this.mapglDraw);
        }
        break;
    }

    // enable the new mode
    switch (mode) {
      case ControlMode.View:
        break;
      case ControlMode.Eraser:
        mapboxCanvas.style.cursor = "cell";
        this.map?.dragPan.disable();
        break;
      case ControlMode.DrawLine:
        mapboxCanvas.style.cursor = "crosshair";
        this.map?.dragPan.disable();
        this.map?.addControl(this.mapglDraw, "bottom-left");
        break;
    }
    this.controlMode = mode;
  }

  static renderTileOnCanvas(
    fogCanvas: FogCanvas,
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
    fowBlock: fogMap.Block,
    blockSizeOffset: number,
    dx: number,
    dy: number
  ): void {
    if (blockSizeOffset <= 0) {
      fogCanvas.RedrawContext().clearRect(dx, dy, 1, 1);
    } else {
      const CANVAS_FOW_PIXEL_SIZE_OFFSET =
        blockSizeOffset - fogMap.BITMAP_WIDTH_OFFSET;
      for (let x = 0; x < fogMap.BITMAP_WIDTH; x++) {
        for (let y = 0; y < fogMap.BITMAP_WIDTH; y++) {
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

  private drawFogCanvas(fogCanvas: FogCanvas) {
    const tile = fogCanvas.tile;
    fogCanvas.beginRedraw();

    if (Object.values(this.fogMap.tiles).length === 0) {
      fogCanvas.endRedraw();
      return;
    }

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
            this.fogMap.tiles[fogMap.FogMap.makeKeyXY(fowTileX, fowTileY)];

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
          this.fogMap.tiles[fogMap.FogMap.makeKeyXY(fowTileX, fowTileY)]
            ?.blocks[fogMap.FogMap.makeKeyXY(fowBlockX, fowBlockY)];

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
          this.fogMap.tiles[fogMap.FogMap.makeKeyXY(fowTileX, fowTileY)]
            ?.blocks;
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

  private onLoadFogCanvas(tile: deckgl.Tile) {
    const fogCanvas = new FogCanvas(tile);
    this.drawFogCanvas(fogCanvas);
    this.loadedFogCanvases[tileToKey(tile)] = fogCanvas;
    return fogCanvas;
  }

  private onUnloadFogCanvas(tile: deckgl.Tile) {
    delete this.loadedFogCanvases[tileToKey(tile)];
  }
}
