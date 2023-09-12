/*eslint no-constant-condition: ["error", { "checkLoops": false }]*/

const GPX_START_TIME = "2019-07-20T08:08:08.000Z";
const MAX_LENGTH_PER_GPX_FILE = 2000;
const MAX_PIXCEL_BETWEEN_GPX_POINTS = 100;

export function sortFilledList(grid: boolean[][]): number[][][] {
  const n = grid.length;
  const result: number[][][] = [];
  while (true) {
    const [firstI, firstJ] = findMinIndex(grid);
    if (firstI == -1) {
      break;
    }
    grid[firstI][firstJ] = false;
    const order: number[][] = [[firstI, firstJ]];
    while (order.length <= MAX_LENGTH_PER_GPX_FILE) {
      const [lastI, lastJ] = order[order.length - 1];
      let minI = -1;
      let minJ = -1;
      let minDistance = Infinity;
      const m = MAX_PIXCEL_BETWEEN_GPX_POINTS;
      for (let i = Math.max(0, lastI - m); i < Math.min(lastI + m, n); i++) {
        for (let j = Math.max(0, lastJ - m); j < Math.min(lastJ + m, n); j++) {
          if (!grid[i][j]) {
            continue;
          }
          const distance = Math.abs(i - lastI) + Math.abs(j - lastJ);
          if (distance < minDistance) {
            minDistance = distance;
            minI = i;
            minJ = j;
          }
        }
      }
      if (minDistance == Infinity) {
        break;
      }
      grid[minI][minJ] = false;
      order.push([minI, minJ]);
    }
    result.push(order);
  }
  return result;
}

export function exportToGpx(lngLatList: number[][]): Blob {
  // ${time}
  // const time = file.meta.time ? `<time>${file.meta.time}</time>` : "";
  let time = new Date(GPX_START_TIME);
  const newGPX = `<?xml version="1.0" encoding="UTF-8" ?>
    <gpx version="1.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.topografix.com/GPX/1/0" xsi:schemaLocation="http://www.topografix.com/GPX/1/0 http://www.topografix.com/GPX/1/0/gpx.xsd">
    <time>${time.toISOString()}</time>
    <trk>
        <trkseg>
        ${lngLatList
          .map((lngLat) => {
            time = addSeconds(time, 1);
            return `<trkpt lon="${lngLat[0]}" lat="${
              lngLat[1]
            }"><time>${time.toISOString()}</time></trkpt>
            `;
          })
          .join("")}
        </trkseg>
    </trk>
    </gpx>
`;

  return new Blob([newGPX], {
    type: "text/GPX;charset=utf-8",
  });
}

function findMinIndex(grid: boolean[][]): number[] {
  const n = grid.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (grid[i][j]) {
        return [i, j];
      }
    }
  }
  return [-1, -1];
}

function addSeconds(date: Date, seconds: number): Date {
  const result = new Date(date);
  result.setSeconds(seconds + result.getSeconds());
  return result;
}
