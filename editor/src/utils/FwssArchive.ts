import JSZip from "jszip";
import { Md5 } from "ts-md5";
import pako from "pako";
import { FogMap } from "./FogMap";
import {
  BLOCK_BITMAP_SIZE,
  MAP_WIDTH,
  Tile,
  TILE_HEADER_SIZE,
  TILE_WIDTH,
} from "./FowTile";

const FOW_FILENAME_ID_DIGIT_MASK = "olhwjsktri";
const FOW_FILENAME_CHECKSUM_DIGIT_MASK = "eizxdwknmo";
const FOW_FILENAME_HASH_TYPE_OFFSET = 74;
const FOW_FILENAME_WIDTH_BY_Z = [
  1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 4096,
];
const FOW_SNAPSHOT_BASE_TILE_Z = 9;
const FOW_SNAPSHOT_MAX_LAYER_Z = FOW_SNAPSHOT_BASE_TILE_Z - 1;
const FOW_SNAPSHOT_MIN_LAYER_Z = -6;
const FOW_SNAPSHOT_TILE_BITSET_SIZE = (MAP_WIDTH * MAP_WIDTH) / 8;
const FOW_SNAPSHOT_METADATA_SIZE = 4012;
const FOW_EARTH_RADIUS_METERS = 6378137.0;
const FOW_PIXELS_PER_BITMAP_BLOCK = BLOCK_BITMAP_SIZE * 8;
const FOW_PIXELS_PER_BASE_TILE =
  TILE_WIDTH * TILE_WIDTH * FOW_PIXELS_PER_BITMAP_BLOCK;
const FOW_HASH_BLOCK_PREFIX = 35;
const FOW_HASH_BLOCK_COUNT_HIGH_OFFSET = 192;
const FOW_METADATA_AREA_SCALE = 10000;
const FOW_METADATA_AREA_NORMALIZE_BITS = 44;
const FOW_METADATA_BASE_VALUE = 17056;
const FOW_METADATA_VERSION = 2;
const FOW_SNAPSHOT_METADATA_FILENAME = "01abfc750a";
const FOW_SNAPSHOT_TILE_INDEX_FILENAME = "3389dae361";

type FwssFileType = "bitmap" | "hash" | "layer";

type SnapshotCoord = {
  x: number;
  y: number;
  z: number;
};

type SnapshotTile = {
  coord: SnapshotCoord;
  blocks: Map<number, Uint8Array>;
};

type Quadrant = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

function basename(path: string): string {
  return path.replace(/^.*[\\/]/, "");
}

export async function importFwss(data: ArrayBuffer): Promise<FogMap> {
  const zip = await new JSZip().loadAsync(data);
  const tileFiles = await Promise.all(
    Object.entries(zip.files)
      .filter(([filename, file]) => {
        return (
          !file.dir &&
          filename.toLowerCase().includes("model/*/") &&
          basename(filename) !== ""
        );
      })
      .map(async ([filename, file]) => {
        const data = await file.async("arraybuffer");
        return [basename(filename), data] as [string, ArrayBuffer];
      })
  );
  return FogMap.createFromFiles(tileFiles);
}

export async function exportFwss(fogMap: FogMap): Promise<Blob | null> {
  const zip = new JSZip();
  const tiles = Object.values(fogMap.tiles)
    .filter((tile) => Object.entries(tile.blocks).length !== 0)
    .sort((a, b) => a.id - b.id);

  if (tiles.length === 0) {
    return null;
  }

  let pendingLayers = new Map<string, SnapshotTile>();
  const tileIndex = new Uint8Array(FOW_SNAPSHOT_TILE_BITSET_SIZE);
  let totalAreaSquareMeters = 0;

  for (const tile of tiles) {
    const snapshotTile = snapshotTileFromTile(tile);
    const bitmapFilename = fowSnapshotFilename(
      snapshotTile.coord.x,
      snapshotTile.coord.y,
      snapshotTile.coord.z,
      "bitmap"
    );
    const hashFilename = fowSnapshotFilename(
      snapshotTile.coord.x,
      snapshotTile.coord.y,
      snapshotTile.coord.z,
      "hash"
    );

    const tileIndexOffset = (tile.y * MAP_WIDTH + tile.x) >> 3;
    tileIndex[tileIndexOffset] |= 1 << tile.x % 8;

    const tileArea = fowTileRowAreaSquareMeters(tile.y);
    totalAreaSquareMeters += Math.floor(
      (tileArea * countSnapshotTilePixels(snapshotTile)) /
        FOW_PIXELS_PER_BASE_TILE
    );

    zip.file(`Model/*/${bitmapFilename}`, serializeBitmapTile(snapshotTile), {
      compression: "STORE",
      createFolders: false,
    });
    zip.file(`Model/#/${hashFilename}`, serializeHashTile(snapshotTile), {
      compression: "STORE",
      createFolders: false,
    });

    pendingLayers.set(snapshotCoordKey(snapshotTile.coord), snapshotTile);
  }

  // In the first iteration, everything has z = FOW_SNAPSHOT_BASE_TILE_Z and we
  // are moving one layer at a time.
  while (pendingLayers.size > 0) {
    const nextLayers = new Map<string, SnapshotTile>();
    const layerTiles = Array.from(pendingLayers.values());

    for (const tile of layerTiles) {
      if (
        tile.coord.z <= FOW_SNAPSHOT_MAX_LAYER_Z &&
        tile.coord.z >= FOW_SNAPSHOT_MIN_LAYER_Z &&
        tile.blocks.size !== 0
      ) {
        const filename = fowSnapshotFilename(
          tile.coord.x,
          tile.coord.y,
          tile.coord.z,
          "layer"
        );
        zip.file(`Model/~/${filename}`, serializeLayerTile(tile), {
          compression: "STORE",
          createFolders: false,
        });
      }

      if (tile.coord.z <= FOW_SNAPSHOT_MIN_LAYER_Z) {
        continue;
      }

      const parent = parentCoord(tile.coord);
      const parentKey = snapshotCoordKey(parent);
      const parentTile = nextLayers.get(parentKey) ?? emptySnapshotTile(parent);
      mergeSubtile(parentTile, tile);
      nextLayers.set(parentKey, parentTile);
    }

    pendingLayers = nextLayers;
  }

  zip.file(
    `Model/#/${FOW_SNAPSHOT_METADATA_FILENAME}`,
    snapshotMetadata(totalAreaSquareMeters),
    { compression: "STORE", createFolders: false }
  );
  zip.file(
    `Model/#/${FOW_SNAPSHOT_TILE_INDEX_FILENAME}`,
    pako.deflate(tileIndex),
    { compression: "STORE", createFolders: false }
  );

  return zip.generateAsync({ type: "blob", compression: "STORE" });
}

function fowSnapshotFilename(
  x: number,
  y: number,
  z: number,
  fileType: FwssFileType
): string {
  const filenameZ = Math.max(z, 0);
  const typeOffset = fileType === "hash" ? FOW_FILENAME_HASH_TYPE_OFFSET : 0;
  const id = FOW_FILENAME_WIDTH_BY_Z[filenameZ] * y + x;
  const checksumInput = id + FOW_SNAPSHOT_BASE_TILE_Z - z + typeOffset;
  const idPart = id
    .toString()
    .split("")
    .map((digit) =>
      FOW_FILENAME_ID_DIGIT_MASK.charAt(Number.parseInt(digit, 10))
    )
    .join("");
  const checksum = ((checksumInput % 100) + 100) % 100;
  const suffix =
    FOW_FILENAME_CHECKSUM_DIGIT_MASK.charAt(Math.floor(checksum / 10)) +
    FOW_FILENAME_CHECKSUM_DIGIT_MASK.charAt(checksum % 10);
  const namePrefix = Md5.hashStr(checksumInput.toString()).substring(0, 4);
  return `${namePrefix}${idPart}${suffix}`;
}

function snapshotTileFromTile(tile: Tile): SnapshotTile {
  const snapshotTile = emptySnapshotTile({
    x: tile.x,
    y: tile.y,
    z: FOW_SNAPSHOT_BASE_TILE_Z,
  });

  Object.values(tile.blocks).forEach((block) => {
    snapshotTile.blocks.set(
      fowBlockIndex(block.x, block.y),
      new Uint8Array(block.bitmap)
    );
  });
  return snapshotTile;
}

function emptySnapshotTile(coord: SnapshotCoord): SnapshotTile {
  return {
    coord,
    blocks: new Map<number, Uint8Array>(),
  };
}

function snapshotCoordKey(coord: SnapshotCoord): string {
  return `${coord.z}:${coord.y}:${coord.x}`;
}

function parentCoord(coord: SnapshotCoord): SnapshotCoord {
  return {
    x: coord.x >> 1,
    y: coord.y >> 1,
    z: coord.z - 1,
  };
}

function positionInParent(coord: SnapshotCoord): Quadrant {
  const right = coord.x % 2 !== 0;
  const bottom = coord.y % 2 !== 0;
  if (!right && !bottom) {
    return "topLeft";
  }
  if (right && !bottom) {
    return "topRight";
  }
  if (!right && bottom) {
    return "bottomLeft";
  }
  return "bottomRight";
}

function quadrantFromXY(x: number, y: number): Quadrant {
  const right = x % 2 !== 0;
  const bottom = y % 2 !== 0;
  if (!right && !bottom) {
    return "topLeft";
  }
  if (right && !bottom) {
    return "topRight";
  }
  if (!right && bottom) {
    return "bottomLeft";
  }
  return "bottomRight";
}

function isBottom(quadrant: Quadrant): boolean {
  return quadrant === "bottomLeft" || quadrant === "bottomRight";
}

function isRight(quadrant: Quadrant): boolean {
  return quadrant === "topRight" || quadrant === "bottomRight";
}

function fowBlockIndex(x: number, y: number): number {
  return x + y * TILE_WIDTH;
}

function mergeSubtile(parent: SnapshotTile, child: SnapshotTile): void {
  const childPosition = positionInParent(child.coord);
  const blockYOffset = isBottom(childPosition) ? 64 : 0;
  const blockXOffset = isRight(childPosition) ? 64 : 0;

  Array.from(child.blocks.entries())
    .sort(([a], [b]) => a - b)
    .forEach(([sourceIdx, sourceBlock]) => {
      const sourceX = sourceIdx % TILE_WIDTH;
      const sourceY = Math.floor(sourceIdx / TILE_WIDTH);
      const blockQuadrant = quadrantFromXY(sourceX, sourceY);
      const destX = Math.floor(sourceX / 2) + blockXOffset;
      const destY = Math.floor(sourceY / 2) + blockYOffset;
      const destIdx = fowBlockIndex(destX, destY);
      const destBlock =
        parent.blocks.get(destIdx) ?? new Uint8Array(BLOCK_BITMAP_SIZE);
      fowPartMergeBlock(destBlock, sourceBlock, blockQuadrant);
      parent.blocks.set(destIdx, destBlock);
    });
}

function fowDownsampleByteToNibble(byte: number): number {
  let result = 0;
  for (let pair = 0; pair < 4; pair++) {
    const mask = 0b11000000 >> (pair * 2);
    if ((byte & mask) !== 0) {
      result |= 1 << (3 - pair);
    }
  }
  return result;
}

function fowPartMergeBlock(
  destBlock: Uint8Array,
  sourceBlock: Uint8Array,
  quadrant: Quadrant
): void {
  const rowOffset = isBottom(quadrant) ? 32 : 0;
  const byteOffset = isRight(quadrant) ? 4 : 0;

  sourceBlock.forEach((sourceByte, sourceOffset) => {
    if (sourceByte === 0) {
      return;
    }
    const sourceByteX = sourceOffset % 8;
    const sourceY = Math.floor(sourceOffset / 8);
    const destOffset =
      byteOffset +
      Math.floor(sourceByteX / 2) +
      8 * (rowOffset + Math.floor(sourceY / 2));
    const nibble = fowDownsampleByteToNibble(sourceByte);
    if (sourceByteX % 2 === 0) {
      destBlock[destOffset] |= nibble << 4;
    } else {
      destBlock[destOffset] |= nibble;
    }
  });
}

function serializeBlocks(
  blocks: Map<number, Uint8Array>,
  blockPayload: (block: Uint8Array) => Uint8Array
): Uint8Array {
  const header = new Uint8Array(TILE_HEADER_SIZE);
  const headerView = new DataView(header.buffer);
  const blockPayloads: Uint8Array[] = [];
  const sortedBlockIndexes = Array.from(blocks.keys()).sort((a, b) => a - b);

  sortedBlockIndexes.forEach((blockIdx, i) => {
    headerView.setUint16(blockIdx * 2, i + 1, true);
    const block = blocks.get(blockIdx);
    if (block) {
      blockPayloads.push(blockPayload(block));
    }
  });

  const payloadSize = blockPayloads.reduce((sum, payload) => {
    return sum + payload.length;
  }, 0);
  const data = new Uint8Array(header.length + payloadSize);
  data.set(header);

  let offset = header.length;
  blockPayloads.forEach((payload) => {
    data.set(payload, offset);
    offset += payload.length;
  });

  return pako.deflate(data);
}

function serializeBitmapTile(tile: SnapshotTile): Uint8Array {
  return serializeBlocks(tile.blocks, (block) => {
    const payload = new Uint8Array(BLOCK_BITMAP_SIZE + 3);
    payload.set(block);
    payload.set(fowBitmapBlockExtraData(block), BLOCK_BITMAP_SIZE);
    return payload;
  });
}

function serializeHashTile(tile: SnapshotTile): Uint8Array {
  return serializeBlocks(tile.blocks, fowHashBlockPayload);
}

function serializeLayerTile(tile: SnapshotTile): Uint8Array {
  return serializeBlocks(tile.blocks, (block) => block);
}

function fowBitmapBlockExtraData(bitmap: Uint8Array): Uint8Array {
  const visitedCount = bitmapVisitedCount(bitmap);
  const score = visitedCount * 2 + 1;
  return new Uint8Array([0, score >> 8, score & 0xff]);
}

function fowHashBlockPayload(bitmap: Uint8Array): Uint8Array {
  const visitedCount = bitmapVisitedCount(bitmap);
  return new Uint8Array([
    FOW_HASH_BLOCK_PREFIX,
    FOW_HASH_BLOCK_COUNT_HIGH_OFFSET + (visitedCount >> 8),
    visitedCount & 0xff,
  ]);
}

function bitmapVisitedCount(bitmap: Uint8Array): number {
  return bitmap.reduce((sum, byte) => sum + countByteBits(byte), 0);
}

function countByteBits(byte: number): number {
  let count = 0;
  while (byte !== 0) {
    count += byte & 1;
    byte >>= 1;
  }
  return count;
}

function countSnapshotTilePixels(tile: SnapshotTile): number {
  return Array.from(tile.blocks.values()).reduce(
    (sum, block) => sum + bitmapVisitedCount(block),
    0
  );
}

function fowTileRowAreaSquareMeters(y: number): number {
  const normalizedY = Math.min(y, MAP_WIDTH - 1 - y);
  const lat = (tileY: number) => {
    return Math.atan(Math.sinh(Math.PI * (1 - (2 * tileY) / MAP_WIDTH)));
  };
  const north = lat(normalizedY);
  const south = lat(normalizedY + 1);
  return (
    FOW_EARTH_RADIUS_METERS *
    FOW_EARTH_RADIUS_METERS *
    ((2 * Math.PI) / MAP_WIDTH) *
    Math.abs(Math.sin(north) - Math.sin(south))
  );
}

function snapshotMetadata(totalAreaSquareMeters: number): Uint8Array {
  const data = new Uint8Array(FOW_SNAPSHOT_METADATA_SIZE);
  let shiftCount = 0;
  let area = Math.floor(totalAreaSquareMeters) * FOW_METADATA_AREA_SCALE;
  const normalizedThreshold = 2 ** FOW_METADATA_AREA_NORMALIZE_BITS;
  while (
    area < normalizedThreshold &&
    shiftCount < FOW_METADATA_AREA_NORMALIZE_BITS
  ) {
    area *= 2;
    shiftCount++;
  }

  writeU64LE(data, 5, area);
  const existing = data[10] | (data[11] << 8);
  const metadata = FOW_METADATA_BASE_VALUE - (shiftCount << 4);
  const encoded = (existing + metadata) & 0xffff;
  data[10] = encoded & 0xff;
  data[11] = encoded >> 8;
  data[0] = FOW_METADATA_VERSION;

  return pako.deflate(data);
}

function writeU64LE(data: Uint8Array, offset: number, value: number): void {
  const u32Size = 0x100000000;
  const view = new DataView(data.buffer, data.byteOffset + offset, 8);
  view.setUint32(0, Math.floor(value % u32Size), true);
  view.setUint32(4, Math.floor(value / u32Size), true);
}
