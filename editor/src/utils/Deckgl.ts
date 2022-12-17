// need typed definitions from luma.gl and deck.gl
/* eslint-disable */
// @ts-nocheck
import mapboxgl from "mapbox-gl";
import { Deck, MapView } from "@deck.gl/core";
import { Texture2D } from "@luma.gl/core";
import { BitmapLayer } from "@deck.gl/layers";
import { TileLayer as DeckglTileLayer } from "@deck.gl/geo-layers";

export class TileCanvas {
  public canvas: HTMLCanvasElement;
  private texture2d: Texture2D | null;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.texture2d = null;
  }

  updateOnce(): void {
    this.texture2d = null;
  }

  _getTexture2D(gl: WebGL2RenderingContext) {
    if (this.texture2d == null) {
      console.log("[DEBUG] new texture2d");
      this.texture2d = new Texture2D(gl, { data: this.canvas });
    }
    return this.texture2d;
  }
}

export class ITileCanvasProvider {
  getTileCanvasForRender(): TileCanvas;
}

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

export class Tile {
  index: { x: number; y: number; z: number };
  bbox: Bbox;
}

export class Deckgl {
  private deck: Deck;
  private tileLayer: DeckglTileLayer;

  constructor(
    map: mapboxgl.Map,
    deckglContainer: HTMLCanvasElement,
    onLoadCanvas: (tile: Tile) => ITileCanvasProvider,
    onUnloadCanvas: (tile: Tile) => void
  ) {
    const tileLayer = new DeckglTileLayer({
      id: "deckgl-tile-layer",
      maxRequests: 10,
      pickable: false,
      minZoom: 0,
      maxZoom: 19,
      tileSize: 512,
      refinementStrategy: "best-available",
      zoomOffset: devicePixelRatio === 1 ? -1 : 0,
      renderSubLayers: (props) => {
        const tile: Tile = props.tile;
        const {
          bbox: { west, south, east, north },
        } = props.tile;

        const tileCanvasProvider = onLoadCanvas(tile);

        const dynamicBitmapLayer = new DynamicBitmapLayer(props, {
          image: null,
          canvas: tileCanvasProvider,
          bounds: [west, south, east, north],
        });

        return [dynamicBitmapLayer];
      },
      onTileUnload: onUnloadCanvas,
    });
    const deck = new Deck({
      canvas: deckglContainer,
      width: "100%",
      height: "100%",
      views: new MapView({ repeat: true }),
      layers: [tileLayer],
    });
    Deckgl.setDeckglView(map, deck);
    map.on("move", () => {
      Deckgl.setDeckglView(map, deck);
    });
    this.deck = deck;
    this.tileLayer = tileLayer;
  }

  private static setDeckglView(map: mapboxgl.Map, deck: Deck) {
    const { lng, lat } = map.getCenter();
    deck.setProps({
      initialViewState: {
        latitude: lat,
        longitude: lng,
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      },
    });
  }

  updateOnce(): void {
    this.tileLayer.setNeedsRedraw(true);
  }
}

class DynamicBitmapLayer extends BitmapLayer {
  draw(opts) {
    const { canvas } = this.props;
    this.props.image = canvas
      .getTileCanvasForRender()
      ._getTexture2D(this.context.gl);
    super.draw(opts);
  }
}
