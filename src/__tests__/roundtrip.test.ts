import { promises as fs } from "fs";
import * as fogMap from "./../utils/FogMap";
import pako from "pako";

test("tile dump roundtrip", async () => {
  const data = await fs.readFile("./src/__tests__/data/23e4lltkkoke");
  let fogMapData = fogMap.FogMap.empty;
  fogMapData = fogMapData.addFiles([["23e4lltkkoke", data]]);
  const tile = fogMapData.tiles[fogMap.FogMap.makeKeyXY(412, 229)];
  const outputData = tile.dump();

  expect(pako.inflate(outputData)).toEqual(pako.inflate(new Uint8Array(data)));
});

export {};
