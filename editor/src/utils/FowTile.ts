import pako from "pako";
import { Md5 } from "ts-md5";
import { Bbox } from "./CommonTypes";

const FILENAME_MASK1 = "olhwjsktri";
const FILENAME_MASK2 = "eizxdwknmo";
const FILENAME_ENCODING: { [key: string]: number } = {};
for (let i = 0; i < FILENAME_MASK1.length; i++) {
  FILENAME_ENCODING[FILENAME_MASK1.charAt(i)] = i;
}

export const MAP_WIDTH = 512;
export const TILE_WIDTH_OFFSET = 7;
export const TILE_WIDTH = 1 << TILE_WIDTH_OFFSET;
const TILE_HEADER_LEN = TILE_WIDTH ** 2;
export const TILE_HEADER_SIZE = TILE_HEADER_LEN * 2;
export const BLOCK_BITMAP_SIZE = 512;
const BLOCK_EXTRA_DATA = 3;
const BLOCK_SIZE = BLOCK_BITMAP_SIZE + BLOCK_EXTRA_DATA;
export const BITMAP_WIDTH_OFFSET = 6;
export const BITMAP_WIDTH = 1 << BITMAP_WIDTH_OFFSET;

export type TileID = number;
export type XYKey = string;

export function makeKeyXY(x: number, y: number): XYKey {
  return `${x}-${y}`;
}

function encodeFowTileFilename(id: TileID): string {
  const digits = id.toString().split("").map(Number);
  const name0 = Md5.hashStr(id.toString()).substring(0, 4);
  const name1 = digits.map((d) => FILENAME_MASK1.charAt(d)).join("");
  const name2 = digits.map((d) => FILENAME_MASK2.charAt(d)).join("");
  return `${name0}${name1}${name2.substring(name2.length - 2)}`;
}

function decodeFowTileFilename(filename: string): TileID {
  return Number.parseInt(
    filename
      .slice(4, -2)
      .split("")
      .map((idMasked) => FILENAME_ENCODING[idMasked])
      .join("")
  );
}

export class Tile {
  readonly filename: string;
  readonly id: TileID;
  readonly x: number;
  readonly y: number;
  readonly blocks: { [key: XYKey]: Block };

  private constructor(
    filename: string,
    id: TileID,
    x: number,
    y: number,
    blocks: { [key: XYKey]: Block }
  ) {
    Object.freeze(blocks);
    this.filename = filename;
    this.id = id;
    this.x = x;
    this.y = y;
    this.blocks = blocks;
  }

  static createEmptyTile(x: number, y: number): Tile {
    const id = y * MAP_WIDTH + x;
    console.log(`Creating tile. id: ${id}, x: ${x}, y: ${y}`);

    const filename = encodeFowTileFilename(id);
    const blocks = {} as { [key: XYKey]: Block };

    return new Tile(filename, id, x, y, blocks);
  }

  static create(filename: string, data: ArrayBuffer): Tile {
    const id = decodeFowTileFilename(filename);
    const x = id % MAP_WIDTH;
    const y = Math.floor(id / MAP_WIDTH);

    console.log(`Loading tile. id: ${id}, x: ${x}, y: ${y}`);

    const actualData = pako.inflate(new Uint8Array(data));

    const header = new Uint16Array(
      actualData.slice(0, TILE_HEADER_SIZE).buffer
    );

    const blocks = {} as { [key: XYKey]: Block };

    for (let i = 0; i < header.length; i++) {
      const blockIdx = header[i];
      if (blockIdx > 0) {
        const blockX = i % TILE_WIDTH;
        const blockY = Math.floor(i / TILE_WIDTH);
        const startOffset = TILE_HEADER_SIZE + (blockIdx - 1) * BLOCK_SIZE;
        const endOffset = startOffset + BLOCK_SIZE;
        const blockData = actualData.slice(startOffset, endOffset);
        const block = Block.create(blockX, blockY, blockData);
        block.check();
        blocks[makeKeyXY(blockX, blockY)] = block;
      }
    }
    return new Tile(filename, id, x, y, blocks);
  }

  dump(): Uint8Array {
    const header = new Uint8Array(TILE_HEADER_SIZE);
    const headerView = new DataView(header.buffer, 0, TILE_HEADER_SIZE);

    const blockDataSize = BLOCK_SIZE * Object.entries(this.blocks).length;

    const blockData = new Uint8Array(blockDataSize);

    let activeBlockIdx = 1;
    Object.values(this.blocks)
      .map((block) => {
        const i = block.x + block.y * TILE_WIDTH;
        return [i, block] as [number, Block];
      })
      .sort((a, b) => {
        return a[0] - b[0];
      })
      .forEach(([i, block]) => {
        headerView.setUint16(i * 2, activeBlockIdx, true);
        blockData.set(block.dump(), (activeBlockIdx - 1) * BLOCK_SIZE);
        activeBlockIdx++;
      });

    const data = new Uint8Array(TILE_HEADER_SIZE + blockDataSize);
    data.set(header);
    data.set(blockData, TILE_HEADER_SIZE);

    return pako.deflate(data);
  }

  static XYToLngLat(x: number, y: number): number[] {
    const lng = (x / 512) * 360 - 180;
    const lat =
      (Math.atan(Math.sinh(Math.PI - (2 * Math.PI * y) / 512)) * 180) / Math.PI;
    return [lng, lat];
  }

  static LngLatToXY(lng: number, lat: number): number[] {
    const x = ((lng + 180) / 360) * 512;
    const y =
      ((Math.PI - Math.asinh(Math.tan((lat / 180) * Math.PI))) * 512) /
      (2 * Math.PI);
    return [x, y];
  }

  bounds(): number[][] {
    const sw = Tile.XYToLngLat(this.x, this.y + 1);
    const se = Tile.XYToLngLat(this.x + 1, this.y + 1);
    const ne = Tile.XYToLngLat(this.x + 1, this.y);
    const nw = Tile.XYToLngLat(this.x, this.y);
    return [nw, ne, se, sw];
  }

  bbox(): Bbox {
    const [west, south] = Tile.XYToLngLat(this.x, this.y + 1);
    const [east, north] = Tile.XYToLngLat(this.x + 1, this.y);
    const bbox = new Bbox(west, south, east, north);
    return bbox;
  }

  addLine(
    x: number,
    y: number,
    e: number,
    p: number,
    dx0: number,
    dy0: number,
    xaxis: boolean,
    quadrants13: boolean
  ): [Tile | null, number, number, number] {
    let mutableBlocks: { [key: XYKey]: Block } | null = null;
    if (xaxis) {
      // Rasterize the line
      for (let i = 0; x < e; i++) {
        if (
          x >> BITMAP_WIDTH_OFFSET >= TILE_WIDTH ||
          y >> BITMAP_WIDTH_OFFSET < 0 ||
          y >> BITMAP_WIDTH_OFFSET >= TILE_WIDTH
        ) {
          break;
        }
        const blockX = x >> BITMAP_WIDTH_OFFSET;
        const blockY = y >> BITMAP_WIDTH_OFFSET;
        const key = makeKeyXY(blockX, blockY);
        let block = this.blocks[key];
        if (!block) {
          block = Block.create(blockX, blockY, null);
        }
        if (block) {
          console.log(
            `block draw: blockx: ${blockX}, blocky: ${blockY} x: ${x}, y: ${y}`
          );
          let newBlock;
          [newBlock, x, y, p] = block.addLine(
            x - (blockX << BITMAP_WIDTH_OFFSET),
            y - (blockY << BITMAP_WIDTH_OFFSET),
            e - (blockX << BITMAP_WIDTH_OFFSET),
            p,
            dx0,
            dy0,
            xaxis,
            quadrants13
          );

          x += blockX << BITMAP_WIDTH_OFFSET;
          y += blockY << BITMAP_WIDTH_OFFSET;

          if (newBlock !== block) {
            if (!mutableBlocks) {
              mutableBlocks = { ...this.blocks };
            }
            if (newBlock) {
              mutableBlocks[key] = newBlock;
            } else {
              delete mutableBlocks[key];
            }
          }
        }
      }
    } else {
      // Rasterize the line
      for (let i = 0; y < e; i++) {
        if (
          y >> BITMAP_WIDTH_OFFSET >= TILE_WIDTH ||
          x >> BITMAP_WIDTH_OFFSET < 0 ||
          x >> BITMAP_WIDTH_OFFSET >= TILE_WIDTH
        ) {
          break;
        }
        const blockX = x >> BITMAP_WIDTH_OFFSET;
        const blockY = y >> BITMAP_WIDTH_OFFSET;
        const key = makeKeyXY(blockX, blockY);
        let block = this.blocks[key];
        if (!block) {
          block = Block.create(blockX, blockY, null);
        }
        if (block) {
          console.log(
            `block draw: blockx: ${blockX}, blocky: ${blockY} x: ${x}, y: ${y}`
          );
          let newBlock;
          [newBlock, x, y, p] = block.addLine(
            x - (blockX << BITMAP_WIDTH_OFFSET),
            y - (blockY << BITMAP_WIDTH_OFFSET),
            e - (blockY << BITMAP_WIDTH_OFFSET),
            p,
            dx0,
            dy0,
            xaxis,
            quadrants13
          );

          x += blockX << BITMAP_WIDTH_OFFSET;
          y += blockY << BITMAP_WIDTH_OFFSET;

          if (newBlock !== block) {
            if (!mutableBlocks) {
              mutableBlocks = { ...this.blocks };
            }
            if (newBlock) {
              mutableBlocks[key] = newBlock;
            } else {
              delete mutableBlocks[key];
            }
          }
        }
      }
    }

    if (mutableBlocks) {
      if (Object.entries(mutableBlocks).length === 0) {
        return [null, x, y, p];
      } else {
        console.log("return updated tile");
        Object.freeze(mutableBlocks);
        return [
          new Tile(this.filename, this.id, this.x, this.y, mutableBlocks),
          x,
          y,
          p,
        ];
      }
    } else {
      return [this, x, y, p];
    }
  }

  clearRect(x: number, y: number, width: number, height: number): Tile | null {
    const xMin = x;
    const yMin = y;
    const xMax = x + width;
    const yMax = y + height;

    const xMinInt = Math.floor(xMin);
    const xMaxInt = Math.floor(xMax);

    const yMinInt = Math.floor(yMin);
    const yMaxInt = Math.floor(yMax);

    let mutableBlocks: { [key: XYKey]: Block } | null = null;

    for (let x = xMinInt; x <= xMaxInt; x++) {
      for (let y = yMinInt; y <= yMaxInt; y++) {
        const key = makeKeyXY(x, y);
        const block = this.blocks[key];
        if (block) {
          const xp0 = Math.round(Math.max(xMin - block.x, 0) * BITMAP_WIDTH);
          const yp0 = Math.round(Math.max(yMin - block.y, 0) * BITMAP_WIDTH);
          const xp1 = Math.round(Math.min(xMax - block.x, 1) * BITMAP_WIDTH);
          const yp1 = Math.round(Math.min(yMax - block.y, 1) * BITMAP_WIDTH);
          const newBlock = block.clearRect(xp0, yp0, xp1 - xp0, yp1 - yp0);

          if (newBlock !== block) {
            if (!mutableBlocks) {
              mutableBlocks = { ...this.blocks };
            }
            if (newBlock) {
              mutableBlocks[key] = newBlock;
            } else {
              delete mutableBlocks[key];
            }
          }
        }
      }
    }

    if (mutableBlocks) {
      if (Object.entries(mutableBlocks).length === 0) {
        return null;
      } else {
        Object.freeze(mutableBlocks);
        return new Tile(this.filename, this.id, this.x, this.y, mutableBlocks);
      }
    } else {
      return this;
    }
  }
}

export class Block {
  readonly x: number;
  readonly y: number;
  readonly bitmap: Uint8Array;
  readonly extraData: Uint8Array;

  private constructor(
    x: number,
    y: number,
    bitmap: Uint8Array,
    extraData: Uint8Array
  ) {
    this.x = x;
    this.y = y;
    this.bitmap = bitmap;
    this.extraData = extraData;
  }

  static create(x: number, y: number, data: Uint8Array | null): Block {
    if (data) {
      const bitmap = data.slice(0, BLOCK_BITMAP_SIZE);
      const extraData = data.slice(BLOCK_BITMAP_SIZE, BLOCK_SIZE);
      return new Block(x, y, bitmap, extraData);
    } else {
      const bitmap = new Uint8Array(BLOCK_BITMAP_SIZE);
      const extraData = new Uint8Array(BLOCK_EXTRA_DATA);
      // FIXME: correct the extraData
      return new Block(x, y, bitmap, extraData);
    }
  }

  check(): boolean {
    const isCorrect = this.visitedCount() === this.count();
    if (!isCorrect) {
      console.warn(`block check sum error!`);
    }
    return isCorrect;
  }

  visitedCount(): number {
    let count = 0;
    for (let i = 0; i < BITMAP_WIDTH; i++) {
      for (let j = 0; j < BITMAP_WIDTH; j++) {
        if (this.isVisited(i, j)) {
          count++;
        }
      }
    }
    return count;
  }

  dump(): Uint8Array {
    const data = new Uint8Array(BLOCK_SIZE);

    const count = this.visitedCount();
    const checksumDataview = new DataView(this.extraData.buffer, 1, 2);
    checksumDataview.setUint16(
      0,
      (checksumDataview.getUint16(0, false) & 0xc000) | ((count << 1) + 1),
      false
    );

    data.set(this.bitmap);
    data.set(this.extraData, BLOCK_BITMAP_SIZE);

    return data;
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
      (new DataView(this.extraData.buffer, 1, 2).getUint16(0, false) &
        0x3fff) >>
      1
    );
  }

  isVisited(x: number, y: number): boolean {
    const bitOffset = 7 - (x % 8);
    const i = Math.floor(x / 8);
    const j = y;
    return (this.bitmap[i + j * 8] & (1 << bitOffset)) !== 0;
  }

  private static setPoint(
    mutableBitmap: Uint8Array,
    x: number,
    y: number,
    val: boolean
  ): void {
    const bitOffset = 7 - (x % 8);
    const i = Math.floor(x / 8);
    const j = y;
    const valNumber = val ? 1 : 0;
    mutableBitmap[i + j * 8] =
      (mutableBitmap[i + j * 8] & ~(1 << bitOffset)) | (valNumber << bitOffset);
  }

  private static bitmapEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.byteLength !== b.byteLength) {
      return false;
    }
    for (let i = 0; i != a.byteLength; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }

  // a modified Bresenham algorithm with initialized error from upper layer
  addLine(
    x: number,
    y: number,
    e: number,
    p: number,
    dx0: number,
    dy0: number,
    xaxis: boolean,
    quadrants13: boolean
  ): [Block, number, number, number] {
    const mutableBitmap = new Uint8Array(this.bitmap);
    console.log(`subblock draw: x:${x}, y:${y}, e:${e}`);
    // Draw the first pixel
    Block.setPoint(mutableBitmap, x, y, true);
    if (xaxis) {
      // Rasterize the line
      for (let i = 0; x < e; i++) {
        x = x + 1;
        // Deal with octants...
        if (p < 0) {
          p = p + 2 * dy0;
        } else {
          if (quadrants13) {
            y = y + 1;
          } else {
            y = y - 1;
          }
          p = p + 2 * (dy0 - dx0);
        }

        if (x >= BITMAP_WIDTH || y < 0 || y >= BITMAP_WIDTH) {
          break;
        }
        // Draw pixel from line span at
        // currently rasterized position
        Block.setPoint(mutableBitmap, x, y, true);
      }
    } else {
      // The line is Y-axis dominant
      // Rasterize the line
      for (let i = 0; y < e; i++) {
        y = y + 1;
        // Deal with octants...
        if (p <= 0) {
          p = p + 2 * dx0;
        } else {
          if (quadrants13) {
            x = x + 1;
          } else {
            x = x - 1;
          }
          p = p + 2 * (dx0 - dy0);
        }

        if (y >= BITMAP_WIDTH || x < 0 || x >= BITMAP_WIDTH) {
          break;
        }
        // Draw pixel from line span at
        // currently rasterized position
        Block.setPoint(mutableBitmap, x, y, true);
      }
    }
    if (Block.bitmapEqual(mutableBitmap, this.bitmap)) {
      return [this, x, y, p];
    } else {
      return [
        new Block(this.x, this.y, mutableBitmap, this.extraData),
        x,
        y,
        p,
      ];
    }
  }

  clearRect(x: number, y: number, width: number, height: number): Block | null {
    const mutableBitmap = new Uint8Array(this.bitmap);

    for (let i = 0; i < width; i++) {
      for (let j = 0; j < height; j++) {
        Block.setPoint(mutableBitmap, x + i, y + j, false);
      }
    }
    if (mutableBitmap.every((v) => v === 0)) {
      return null;
    }
    if (Block.bitmapEqual(mutableBitmap, this.bitmap)) {
      return this;
    } else {
      return new Block(this.x, this.y, mutableBitmap, this.extraData);
    }
  }
}
