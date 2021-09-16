// TODO: consider reactify this?
import mapboxgl from 'mapbox-gl';
import * as fogMap from './FogMap';
import * as tileLayer from './TileLayer';

const FOW_TILE_ZOOM = 9;
const FOW_BLOCK_ZOOM = FOW_TILE_ZOOM + fogMap.BITMAP_WIDTH_OFFSET;


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

      // TODO: include zoom==9
    } else if (tile.z > FOW_TILE_ZOOM) {
      // sub-tile rendering
      const zoomOffset = tile.z - FOW_TILE_ZOOM;
      const fowTileX = tile.x >> zoomOffset;
      const fowTileY = tile.y >> zoomOffset;
      const subTileMask = (1 << zoomOffset) - 1;
      console.log(`subtilemask ${subTileMask}`);
      // const fowSubTileX = (tile.x & subTileMask);
      const fowSubTileX = (tile.x & subTileMask) << (fogMap.TILE_WIDTH_OFFSET - zoomOffset);
      // const fowSubTileY = (tile.y & subTileMask);
      const fowSubTileY = (tile.y & subTileMask) << (fogMap.TILE_WIDTH_OFFSET - zoomOffset);
      console.log(`fowTileX ${fowTileX}  fowTileY ${fowTileY}  fowSubTileX ${fowSubTileX}  forSubTileY ${fowSubTileY}`);

      // TODO: currently we assume a block is at least a pixel, what if a block is subpixel?
      // canvas is 128 * 128 block
      // if zoomoffset = 0
      // cbs is 512/128 = 4
      // if zoomoffset = 1
      // cbs is 512/(128/2) = 8
      const CANVAS_BLOCK_SIZE_OFFSET = MAP_TILE_SIZE_OFFSET - fogMap.TILE_WIDTH_OFFSET + zoomOffset;
      const CANVAS_BLOCK_SIZE = 1 << CANVAS_BLOCK_SIZE_OFFSET;
      // Object.values(fogMap)
      // Object.values(this.blocks).filter(block => (block.x >= xMinInt) && (block.x <= xMaxInt) && (block.y >= yMinInt) && (block.y <= yMaxInt)); 
      // for each block within the range, load on to canvas
    } else {
      // render multiple fow tiles
    }


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
