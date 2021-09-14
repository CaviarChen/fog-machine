// need typed definitions from luma.gl and deck.gl
// @ts-nocheck
import mapboxgl from 'mapbox-gl';
import { Texture2D } from '@luma.gl/core';
import { MapboxLayer } from '@deck.gl/mapbox';
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

export class TileLayer {

  constructor(map: mapboxgl.Map, onLoadCanvas: (tile: Tile) => TileCanvas) {
    const tileLayer =
      new MapboxLayer({
        id: 'deckgl-tile-layer',
        type: DeckglTileLayer,
        maxRequests: 10,
        pickable: false,
        minZoom: 0,
        maxZoom: 19,
        tileSize: 512,
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
    map.addLayer(tileLayer);
  }
}

class DynamicBitmapLayer extends BitmapLayer {
  draw(opts) {
    const { canvas } = this.props;
    this.props.image = canvas._getTexture2D(this.context.gl);
    super.draw(opts);
  }
}