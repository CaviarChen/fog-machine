import { ITileCanvasProvider, Tile, TileCanvas } from "./Deckgl";

export const CANVAS_SIZE_OFFSET = 9;
export const CANVAS_SIZE = 1 << CANVAS_SIZE_OFFSET;

function generateAllFogTileCanvas(): TileCanvas {
  const tileCanvas = new TileCanvas();
  const canvas = tileCanvas.canvas;
  const ctx = tileCanvas.canvas.getContext("2d")!;
  canvas.width = 2;
  canvas.height = 2;
  ctx.fillStyle = "rgba(0, 0, 0, 1)";
  ctx.fillRect(0, 0, 2, 2);
  tileCanvas.updateOnce();
  return tileCanvas;
}

const allFogTileCanvas = generateAllFogTileCanvas();

export class FogCanvas implements ITileCanvasProvider {
  public tile: Tile;
  public tileCanvas: TileCanvas | null;

  // only used during redrawing
  private drawingContext: CanvasRenderingContext2D | null;

  constructor(tile: Tile) {
    this.tile = tile;
    this.tileCanvas = null;
    this.drawingContext = null;
  }

  getTileCanvasForRender(): TileCanvas {
    return this.tileCanvas ? this.tileCanvas : allFogTileCanvas;
  }

  // we don't really handle unexpected cases such as calling the follow functions
  // in a wrong order. maybe we should redesign this to have a type safe way to
  // enforce the requirement.
  beginRedraw(): void {
    this.drawingContext = null;
  }

  // this should be called eagerly
  RedrawContext(): CanvasRenderingContext2D {
    if (this.drawingContext) {
      return this.drawingContext;
    }
    if (!this.tileCanvas) {
      this.tileCanvas = new TileCanvas();
      this.tileCanvas.canvas.width = CANVAS_SIZE;
      this.tileCanvas.canvas.height = CANVAS_SIZE;
    }

    const ctx = this.tileCanvas.canvas.getContext("2d")!;
    ctx.fillStyle = "rgba(0, 0, 0, 1)";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    this.drawingContext = ctx;
    return ctx;
  }

  endRedraw(): void {
    if (this.drawingContext) {
      this.tileCanvas?.updateOnce();
    } else {
      // all fog
      this.tileCanvas = null;
    }
    this.drawingContext = null;
  }
}
