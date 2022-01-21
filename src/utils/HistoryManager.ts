import * as fogMap from "./FogMap";
import * as deckgl from "./Deckgl";

const MAX_HISTORY_SIZE = 20;

class HistoryItem {
  public readonly fogMap: fogMap.FogMap;
  public readonly areaChanged: deckgl.Bbox | null;
  public constructor(fogMap: fogMap.FogMap, areaChanged: deckgl.Bbox | null) {
    this.fogMap = fogMap;
    this.areaChanged = areaChanged;
  }
}

export class HistoryManager {
  // use ring buffer instead?
  private history: HistoryItem[];
  private pos: number;
  public constructor(initialMap: fogMap.FogMap) {
    this.history = [new HistoryItem(initialMap, null)];
    this.pos = 0;
  }

  public canRedo(): boolean {
    return this.pos + 1 < this.history.length;
  }

  public canUndo(): boolean {
    return this.pos > 0;
  }

  public append(newMap: fogMap.FogMap, areaChanged: deckgl.Bbox | null): void {
    while (this.history.length > this.pos + 1) {
      this.history.pop();
    }
    this.history.push(new HistoryItem(newMap, areaChanged));
    if (this.history.length > MAX_HISTORY_SIZE) {
      this.history.shift();
    } else {
      this.pos += 1;
    }
  }

  public undo(
    apply: (map: fogMap.FogMap, areaChanged: deckgl.Bbox | null) => void
  ): void {
    if (this.canUndo()) {
      this.pos -= 1;
      // `apply` should be called after the pos update
      apply(
        this.history[this.pos].fogMap,
        this.history[this.pos + 1].areaChanged
      );
    }
  }

  public redo(
    apply: (map: fogMap.FogMap, areaChanged: deckgl.Bbox | null) => void
  ): void {
    if (this.canRedo()) {
      this.pos += 1;
      const item = this.history[this.pos];
      apply(item.fogMap, item.areaChanged);
    }
  }
}
