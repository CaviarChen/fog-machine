import { promises as fs } from "fs";
import JSZip from "jszip";
import pako from "pako";
import { FogMap, Block, Tile } from "./../utils/FogMap";
import { exportFowSync, importFowSyncZip } from "./../utils/FowSyncArchive";
import { exportFwss, importFwss } from "./../utils/FwssArchive";

function expectBitmapEqual(a: Block, b: Block): void {
  expect(Array.from(a.bitmap)).toEqual(Array.from(b.bitmap));
}

function expectTileBitmapEqual(a: Tile, b: Tile): void {
  expect(Object.keys(a.blocks).sort()).toEqual(Object.keys(b.blocks).sort());
  Object.keys(a.blocks).forEach((key) => {
    expectBitmapEqual(a.blocks[key], b.blocks[key]);
  });
}

function expectFogMapBitmapEqual(a: FogMap, b: FogMap): void {
  expect(Object.keys(a.tiles).sort()).toEqual(Object.keys(b.tiles).sort());
  Object.keys(a.tiles).forEach((key) => {
    expectTileBitmapEqual(a.tiles[key], b.tiles[key]);
  });
}

function countBits(data: Uint8Array): number {
  return data.reduce((sum, byte) => {
    let count = 0;
    while (byte !== 0) {
      count += byte & 1;
      byte >>= 1;
    }
    return sum + count;
  }, 0);
}

async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as ArrayBuffer);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}

async function fixtureMap(): Promise<FogMap> {
  const data1 = await fs.readFile("./src/__tests__/data/23e4lltkkoke");
  const data2 = await fs.readFile("./src/__tests__/data/cd36lltksiwo");
  return FogMap.createFromFiles([
    ["23e4lltkkoke", data1],
    ["cd36lltksiwo", data2],
  ]);
}

test("sync archive roundtrip", async () => {
  const map = await fixtureMap();
  const blob = await exportFowSync(map);
  expect(blob).not.toBeNull();

  const data = await blobToArrayBuffer(blob!);
  const zip = await new JSZip().loadAsync(data);
  expect(Object.keys(zip.files).sort()).toEqual([
    "Sync/",
    "Sync/23e4lltkkoke",
    "Sync/cd36lltksiwo",
  ]);

  const roundtripped = await importFowSyncZip(data);
  expectFogMapBitmapEqual(map, roundtripped);
});

test("fwss archive roundtrip", async () => {
  const map = await fixtureMap();
  const blob = await exportFwss(map);
  expect(blob).not.toBeNull();

  const data = await blobToArrayBuffer(blob!);
  const zip = await new JSZip().loadAsync(data);
  const names = Object.keys(zip.files);

  expect(Object.values(zip.files).some((file) => file.dir)).toBe(false);
  expect(names.some((name) => name.startsWith("Model/*/"))).toBe(true);
  expect(names.some((name) => name.startsWith("Model/#/"))).toBe(true);
  expect(names.some((name) => name.startsWith("Model/~/"))).toBe(true);
  expect(names).toContain("Model/#/01abfc750a");
  expect(names).toContain("Model/#/3389dae361");

  const tileIndexData = await zip
    .file("Model/#/3389dae361")!
    .async("arraybuffer");
  const tileIndex = pako.inflate(new Uint8Array(tileIndexData));
  expect(countBits(tileIndex)).toEqual(Object.keys(map.tiles).length);

  const roundtripped = await importFwss(data);
  expectFogMapBitmapEqual(map, roundtripped);
});
