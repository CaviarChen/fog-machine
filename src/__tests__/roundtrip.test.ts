import { promises as fs } from "fs";
import * as fogMap from "./../utils/FogMap";

test("tile dump roundtrip", async () => {
  const data = await fs.readFile("./src/__tests__/data/23e4lltkkoke");
  const fogMapData = new fogMap.Map();
  fogMapData.addFile("23e4lltkkoke", data);
  const tile = fogMapData.tiles[fogMap.Map.makeKeyXY(412, 229)];
  const outputData = tile.dump();
  expect(outputData).toEqual(new Uint8Array(data));
});

export {};
