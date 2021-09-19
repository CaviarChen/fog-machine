// need typed definitions from luma.gl and deck.gl
// @ts-nocheck
import mapboxgl from 'mapbox-gl';
import { Deck } from '@deck.gl/core';
import { Texture2D } from '@luma.gl/core';
import { BitmapLayer } from '@deck.gl/layers';
import { TileLayer as DeckglTileLayer } from '@deck.gl/geo-layers';

export class TileCanvas {
  private canvas: HTMLCanvasElement;
  private texture2d: Texture2D | null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.texture2d = null
  }

  updateOnce() {
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

class Bbox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export class Tile {
  x: number;
  y: number;
  z: number;
  bbox: Bbox;
}

export class Deckgl {

  constructor(map: mapboxgl.Map, deckglContainer: HTMLCanvasElement, onLoadCanvas: (tile: Tile) => TileCanvas) {
    const tileLayer =
      new DeckglTileLayer({
        id: 'deckgl-tile-layer',
        maxRequests: 10,
        pickable: false,
        minZoom: 0,
        maxZoom: 19,
        tileSize: 512,
        refinementStrategy: 'best-available',
        zoomOffset: devicePixelRatio === 1 ? -1 : 0,
        renderSubLayers: props => {
          let tile: Tile = props.tile;
          const { bbox: { west, south, east, north } } = props.tile;
          let tileCanvas = onLoadCanvas(tile);

          let dynamicBitmapLayer =
            new DynamicBitmapLayer(props, {
              image: null,
              canvas: tileCanvas,
              bounds: [west, south, east, north],
            });

          return [dynamicBitmapLayer];
        }
      });
    let deck = new Deck({
      canvas: deckglContainer,
      width: '100%',
      height: '100%',
      layers: [tileLayer]
    });
    Deckgl.setDeckglView(map, deck);
    map.on("move", () => {
      Deckgl.setDeckglView(map, deck);
    });
  }

  private static setDeckglView(map: mapboxgl.Map, deck: Deck) {
    let { lng, lat } = map.getCenter();
    deck.setProps({
      initialViewState: {
        latitude: lat,
        longitude: lng,
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch()
      }
    });
  }
}

class DynamicBitmapLayer extends BitmapLayer {
  draw(opts) {
    const { canvas } = this.props;
    this.props.image = canvas._getTexture2D(this.context.gl);
    super.draw(opts);
  }
}