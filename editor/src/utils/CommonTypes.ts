export class Bbox {
  west: number;
  south: number;
  east: number;
  north: number;

  constructor(west: number, south: number, east: number, north: number) {
    this.west = west;
    this.south = south;
    this.east = east;
    this.north = north;
  }
}

// NOTE: this does not handle wraparound
function _isBboxOverlap(a: Bbox, b: Bbox) {
  return (
    a.north >= b.south &&
    b.north >= a.south &&
    a.east >= b.west &&
    b.east >= a.west
  );
}
