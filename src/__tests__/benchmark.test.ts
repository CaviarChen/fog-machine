import { promises as fs } from "fs";
import * as fogMap from "./../utils/FogMap";

function timeit(text: string, f: () => void): void {
  const startTime = performance.now();
  f();
  const endTime = performance.now();
  console.log(`${text} took ${endTime - startTime} milliseconds`);
}

test("fogMap", async () => {
  const data1 = await fs.readFile("./src/__tests__/data/23e4lltkkoke");
  const data2 = await fs.readFile("./src/__tests__/data/cd36lltksiwo");
  let fogMapData = fogMap.FogMap.empty();
  timeit("fogMap.Map.addFile", () => {
    fogMapData = fogMapData.addFiles([["23e4lltkkoke", data1], ["cd36lltksiwo", data2]]);
  });

  let visitedCount = 0;
  timeit("count visited", () => {
    [
      [412, 229],
      [411, 229],
    ].forEach(([x, y]) => {
      const tile = fogMapData.tiles[fogMap.FogMap.makeKeyXY(x, y)];
      Object.values(tile.blocks).forEach((block) => {
        for (let i = 0; i < 64; i++) {
          for (let j = 0; j < 64; j++) {
            if (block.isVisited(i, j)) {
              visitedCount++;
            }
          }
        }
      });
    });
  });
  expect(visitedCount).toEqual(36983);
});

export {};
