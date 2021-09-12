import mapboxgl from 'mapbox-gl';
import { MapboxLayer } from '@deck.gl/mapbox';
import { BitmapLayer } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';
import {Texture2D } from '@luma.gl/core';


// Set your mapbox token here
mapboxgl.accessToken = "pk.eyJ1IjoidGF2aW1vcmkiLCJhIjoiY2ozeHh3NXdjMDAwYTJ3bnk2ZXhqbTkzbiJ9.BGLmrBqqXkZv50HKrwaZRQ"; // eslint-disable-line

class DynamicBitmapLayer extends BitmapLayer {

  draw(opts) {
    const { canvas } = this.props;
    this.props.image = canvas.getTexture2D(this.context.gl);
    super.draw(opts);
  }

}

class DynamicBitmapLayerCanvas {
  constructor(canvas) {
    this.canvas = canvas;
    this.texture2d = null
  }

  updateOnce() {
    this.texture2d = null;
  }

  getTexture2D(gl) {
    if (this.texture2d == null) {
      console.log("new texture2d");
      this.texture2d = new Texture2D(gl, {data: this.canvas});
    } 
    return this.texture2d;
  }
}

export function renderToDOM(container, data) {
  const map = new mapboxgl.Map({
    container,
    style: 'mapbox://styles/mapbox/light-v9',
    antialias: true,
    center: [-122.4034, 37.7845],
    zoom: 15.5,
  });

  map.addControl(new mapboxgl.NavigationControl(), 'top-left');

  map.on('load', () => {

    renderLayers(map, data);
  });

  return {
    update: newData => renderLayers(map, newData),
    remove: () => {
      map.remove();
    }
  };
}

function renderLayers(map, data) {

  const tileLayer =
    new MapboxLayer({
      id: 'xxx',
      type: TileLayer,
      maxRequests: 10,
      data: null,
      pickable: false,
      // https://wiki.openstreetmap.org/wiki/Zoom_levels
      minZoom: 0,
      maxZoom: 19,
      tileSize: 512,
      zoomOffset: devicePixelRatio === 1 ? -1 : 0,
      myFlag: false,
      renderSubLayers: props => {
        const {
          x,
          y,
          z,
          bbox: { west, south, east, north }
        } = props.tile;


        let canvas = document.createElement("canvas");
        let ctx = canvas.getContext("2d");
        canvas.width = 512;
        canvas.height = 512;
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.fillRect(0, 0, 512, 512);

        ctx.beginPath();
        ctx.lineWidth = "6";
        ctx.strokeStyle = "red";
        ctx.rect(0, 0, 512, 512);
        ctx.stroke();

        let dynamicBitmapLayerCanvas = new DynamicBitmapLayerCanvas(canvas);

        let bitmapLayer =
          new DynamicBitmapLayer(props, {
            image: null,
            canvas: dynamicBitmapLayerCanvas,
            bounds: [west, south, east, north],
          });

        setTimeout(() => {
          ctx.clearRect(0, 0, 512, 512);
          ctx.beginPath();
          ctx.lineWidth = "6";
          ctx.strokeStyle = "blue";
          ctx.rect(0, 0, 512, 512);
          ctx.stroke();
          dynamicBitmapLayerCanvas.updateOnce();
          map.triggerRepaint();
        }, 2000);

        return [
          bitmapLayer
        ];
      }
    });


  map.addLayer(tileLayer);
}


export async function loadAndRender(container) {
  renderToDOM(container, {});
}
