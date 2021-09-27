import pako from "pako";
import * as deckgl from "./Deckgl";

const FILENAME_MASK1 = "olhwjsktri";
// const FILENAME_MASK2 = "eizxdwknmo";
const FILENAME_ENCODING: { [key: string]: number } = {};
for (let i = 0; i < FILENAME_MASK1.length; i++) {
  FILENAME_ENCODING[FILENAME_MASK1.charAt(i)] = i;
}
const MAP_WIDTH = 512;
export const TILE_WIDTH_OFFSET = 7;
export const TILE_WIDTH = 1 << TILE_WIDTH_OFFSET;
const TILE_HEADER_LEN = TILE_WIDTH ** 2;
const TILE_HEADER_SIZE = TILE_HEADER_LEN * 2;
const BLOCK_BITMAP_SIZE = 512;
const BLOCK_EXTRA_DATA = 3;
const BLOCK_SIZE = BLOCK_BITMAP_SIZE + BLOCK_EXTRA_DATA;
export const BITMAP_WIDTH_OFFSET = 6;
export const BITMAP_WIDTH = 1 << BITMAP_WIDTH_OFFSET;

// SAD: Type Aliases do not seem to give us type safety
export type TileID = number;
export type XYKey = string;

export class Map {
  tiles: { [key: XYKey]: Tile };
  regionCount: { [key: string]: number };

  constructor() {
    this.tiles = {};
    this.regionCount = {};
  }

  // It is so silly that tuple cannot be used as key
  static makeKeyXY(x: number, y: number): XYKey {
    return `${x}-${y}`;
  }

  // TODO: merge instead of override
  addFile(filename: string, data: ArrayBuffer): Tile | undefined {
    try {
      const tile = new Tile(filename, data);

      this.tiles[Map.makeKeyXY(tile.x, tile.y)] = tile;
      for (const [region, count] of Object.entries(tile.regionCount)) {
        this.regionCount[region] = (this.regionCount[region] || 0) + count;
      }
      console.log(this.regionCount);
      return tile;
    } catch (e) {
      // TODO: handle error properly
      console.log(`${filename} is not a valid tile file.`);
      console.log(e);
    }
  }
}

export class Tile {
  filename: string;
  id: TileID;
  x: number;
  y: number;
  data: Uint8Array;
  blocks: { [key: XYKey]: Block };
  regionCount: { [key: string]: number };

  constructor(filename: string, data: ArrayBuffer) {
    // TODO: try catch
    this.filename = filename;
    this.id = Number.parseInt(
      filename
        .slice(4, -2)
        .split("")
        .map((idMasked) => FILENAME_ENCODING[idMasked])
        .join("")
    );
    this.x = this.id % MAP_WIDTH;
    this.y = Math.floor(this.id / MAP_WIDTH);

    console.log(`Loading tile. id: ${this.id}, x: ${this.x}, y: ${this.y}`);

    // TODO: try catch
    this.data = pako.inflate(new Uint8Array(data));

    const header = new Uint16Array(this.data.slice(0, TILE_HEADER_SIZE).buffer);
    this.blocks = {};
    this.regionCount = {};

    for (let i = 0; i < header.length; i++) {
      const block_idx = header[i];
      if (block_idx > 0) {
        const block_x = i % TILE_WIDTH;
        const block_y = Math.floor(i / TILE_WIDTH);
        const start_offset = TILE_HEADER_SIZE + (block_idx - 1) * BLOCK_SIZE;
        const end_offset = start_offset + BLOCK_SIZE;
        const block_data = this.data.slice(start_offset, end_offset);
        const block = new Block(block_x, block_y, block_data);
        this.blocks[Map.makeKeyXY(block_x, block_y)] = block;
        this.regionCount[block.region()] =
          (this.regionCount[block.region()] || 0) + block.count();
        this.regionCount["BLK"] = (this.regionCount["BLK"] || 0) + 1;
      }
    }
  }

  static XYToLngLat(x: number, y: number): number[] {
    const lng = (x / 512) * 360 - 180;
    const lat =
      (Math.atan(Math.sinh(Math.PI - (2 * Math.PI * y) / 512)) * 180) / Math.PI;
    return [lng, lat];
  }

  bounds(): number[][] {
    const sw = Tile.XYToLngLat(this.x, this.y + 1);
    const se = Tile.XYToLngLat(this.x + 1, this.y + 1);
    const ne = Tile.XYToLngLat(this.x + 1, this.y);
    const nw = Tile.XYToLngLat(this.x, this.y);
    return [nw, ne, se, sw];
  }

  bbox(): deckgl.Bbox {
    const [west, south] = Tile.XYToLngLat(this.x, this.y + 1);
    const [east, north] = Tile.XYToLngLat(this.x + 1, this.y);
    const bbox = new deckgl.Bbox(west, south, east, north);
    return bbox;
  }
}

export class Block {
  x: number;
  y: number;
  bitmap: Uint8Array;
  extraData: Uint8Array;

  constructor(x: number, y: number, data: Uint8Array) {
    this.x = x;
    this.y = y;
    this.bitmap = data.slice(0, BLOCK_BITMAP_SIZE);
    this.extraData = data.slice(BLOCK_BITMAP_SIZE, BLOCK_SIZE);
    // this.texture = gl.createTexture();
  }

  region(): string {
    const regionChar0 = String.fromCharCode(
      (this.extraData[0] >> 3) + "?".charCodeAt(0)
    );
    const regionChar1 = String.fromCharCode(
      (((this.extraData[0] & 0x7) << 2) | ((this.extraData[1] & 0xc0) >> 6)) +
        "?".charCodeAt(0)
    );
    return regionChar0 + regionChar1;
  }

  count(): number {
    return (
      (new DataView(this.extraData.buffer, 1, 2).getInt16(0, false) & 0x3fff) >>
      1
    );
  }

  is_visited(x: number, y: number): boolean {
    const bit_offset = 7 - (x % 8);
    const i = Math.floor(x / 8);
    const j = y;
    return (this.bitmap[i + j * 8] & (1 << bit_offset)) !== 0;
  }

  setPoint(x: number, y: number, val: boolean) {
    const bit_offset = 7 - x % 8;
    const i = Math.floor(x / 8);
    const j = y;
    const val_number = val? 1:0;
    this.bitmap[i + j * 8] = (this.bitmap[i + j * 8] & (~(1 << bit_offset))) | (val_number << bit_offset);
  }

  setRect(x: number, y: number, width: number, height: number, val: boolean) {
    for (let i=0; i < width; i++) {
      for (let j=0; j<height; j++) {
        this.setPoint(x+i, y+j, val)
      }
    }
  }
}
