import { ITileCanvasProvider, Tile, TileCanvas } from "./Deckgl";

export class FogCanvas implements ITileCanvasProvider {
  public tile: Tile;
  public tileCanvas: TileCanvas;
  constructor(tile: Tile) {
    this.tile = tile;
    this.tileCanvas = new TileCanvas();
  }

  getTileCanvasForRender() : TileCanvas {
      return this.tileCanvas;
  }
}