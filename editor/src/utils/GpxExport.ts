/*eslint no-constant-condition: ["error", { "checkLoops": false }]*/

const GPX_START_TIME = "2019-07-20T08:08:08.000Z";
const MAX_LENGTH_PER_GPX_FILE = 2000;
const MAX_PIXCEL_BETWEEN_GPX_POINTS = 100;

export function sortFilledList(grid: boolean[][]): number[][][] {
  const n = grid.length;
  const track: number[][][] = [];
  while (true) {
    // TODO: A hashqueue should be able to reduce the time complecity a lot.
    const minIndex = findMinIndex(grid);
    if (!minIndex) {
      break;
    }
    const [firstI, firstJ] = minIndex;
    grid[firstI][firstJ] = false;

    const trackSegment: number[][] = [[firstI, firstJ]];
    while (trackSegment.length <= MAX_LENGTH_PER_GPX_FILE) {
      const [lastI, lastJ] = trackSegment[trackSegment.length - 1];
      let minI = -1;
      let minJ = -1;
      let minDistance = Infinity;
      for (
        let i = Math.max(0, lastI - MAX_PIXCEL_BETWEEN_GPX_POINTS);
        i < Math.min(lastI + MAX_PIXCEL_BETWEEN_GPX_POINTS, n);
        i++
      ) {
        for (
          let j = Math.max(0, lastJ - MAX_PIXCEL_BETWEEN_GPX_POINTS);
          j < Math.min(lastJ + MAX_PIXCEL_BETWEEN_GPX_POINTS, n);
          j++
        ) {
          if (grid[i][j]) {
            const distance = Math.abs(i - lastI) + Math.abs(j - lastJ);
            if (distance < minDistance) {
              minDistance = distance;
              minI = i;
              minJ = j;
            }
          }
        }
      }
      if (minDistance != Infinity) {
        grid[minI][minJ] = false;
        trackSegment.push([minI, minJ]);
      }
    }
    track.push(trackSegment);
  }
  return track;
}

export function exportToGpx(lngLatList: number[][]): Blob {
  let time = new Date(GPX_START_TIME);
  const newGPX = `<?xml version="1.0" encoding="UTF-8" ?>
    <gpx version="1.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.topografix.com/GPX/1/0" xsi:schemaLocation="http://www.topografix.com/GPX/1/0 http://www.topografix.com/GPX/1/0/gpx.xsd">
    <time>${time.toISOString()}</time>
    <trk>
        <trkseg>
        ${lngLatList
      .map((lngLat) => {
        time = addSeconds(time, 1);
        return `<trkpt lon="${lngLat[0]}" lat="${lngLat[1]
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

function findMinIndex(grid: boolean[][]): [number, number] | null {
  const n = grid.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (grid[i][j]) {
        return [i, j];
      }
    }
  }
  return null;
}

function addSeconds(date: Date, seconds: number): Date {
  const result = new Date(date);
  result.setSeconds(seconds + result.getSeconds());
  return result;
}
