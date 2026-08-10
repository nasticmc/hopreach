// Leaflet overlay that turns HopReach's existing Terrarium DEM tiles into a
// translucent hypsometric elevation tint. The RF raster remains in Leaflet's
// default overlay pane (z-index 400); this layer is deliberately rendered in
// the lower elevation pane so coverage is never obscured by terrain colour.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HopReachElevationHeatmap = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const TILE_SIZE = 256;
  const DEFAULT_URL = "/dem-tiles/{z}/{x}/{y}.png";

  function terrariumElevation(red, green, blue) {
    return red * 256 + green + blue / 256 - 32768;
  }

  // A compact hypsometric palette: deep water -> lowland green -> upland
  // ochre -> alpine white. Interpolation avoids hard contour-like bands.
  const STOPS = [
    [-500, [22, 50, 73]],
    [0, [45, 92, 79]],
    [250, [90, 133, 86]],
    [750, [178, 160, 92]],
    [1500, [157, 105, 72]],
    [3000, [210, 202, 188]],
    [5000, [255, 255, 255]],
  ];

  function legendGradient() {
    const low = STOPS[0][0];
    const span = STOPS[STOPS.length - 1][0] - low;
    return `linear-gradient(90deg, ${STOPS.map(([metres, color]) =>
      `rgb(${color.join(", ")}) ${((metres - low) / span * 100).toFixed(2)}%`
    ).join(", ")})`;
  }

  function elevationColor(metres, range) {
    // Stretch the complete palette across the elevations in the current
    // viewport. Keeping this transform here means tiles and the legend use
    // precisely the same scale rather than merely relabelling fixed colours.
    if (range && range.max > range.min) {
      const paletteMin = STOPS[0][0];
      const paletteMax = STOPS[STOPS.length - 1][0];
      metres = paletteMin + (metres - range.min) / (range.max - range.min) * (paletteMax - paletteMin);
    }
    let upper = 1;
    while (upper < STOPS.length && metres > STOPS[upper][0]) upper++;
    if (upper === STOPS.length) return [...STOPS[STOPS.length - 1][1]];
    const [lowM, lowColor] = STOPS[upper - 1];
    const [highM, highColor] = STOPS[upper];
    const t = Math.max(0, (metres - lowM) / (highM - lowM));
    return lowColor.map((channel, i) => Math.round(channel + (highColor[i] - channel) * t));
  }

  function colorizeTerrarium(rgba, range) {
    const output = rgba.slice();
    for (let i = 0; i < rgba.length; i += 4) {
      const color = elevationColor(terrariumElevation(rgba[i], rgba[i + 1], rgba[i + 2]), range);
      output[i] = color[0];
      output[i + 1] = color[1];
      output[i + 2] = color[2];
      output[i + 3] = rgba[i + 3];
    }
    return output;
  }

  function createLayer(L, options = {}) {
    const urlTemplate = options.url || DEFAULT_URL;
    const HeatmapLayer = L.GridLayer.extend({
      createTile(coords, done) {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = TILE_SIZE;
        canvas.setAttribute("role", "presentation");
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => {
          try {
            const context = canvas.getContext("2d", { willReadFrequently: true });
            context.drawImage(image, 0, 0, TILE_SIZE, TILE_SIZE);
            const pixels = context.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
            canvas._hopreachElevationPixels = pixels.data.slice();
            pixels.data.set(colorizeTerrarium(canvas._hopreachElevationPixels));
            context.putImageData(pixels, 0, 0);
            this._scheduleRescale();
            done(null, canvas);
          } catch (error) {
            done(error, canvas);
          }
        };
        image.onerror = () => done(new Error(`DEM tile failed: ${image.src}`), canvas);
        image.src = urlTemplate
          .replace("{z}", coords.z)
          .replace("{x}", coords.x)
          .replace("{y}", coords.y);
        return canvas;
      },
      onAdd(map) {
        L.GridLayer.prototype.onAdd.call(this, map);
        this._rescaleHandler = () => this._scheduleRescale();
        map.on("move zoom", this._rescaleHandler);
      },
      onRemove(map) {
        map.off("move zoom", this._rescaleHandler);
        L.GridLayer.prototype.onRemove.call(this, map);
      },
      _scheduleRescale() {
        if (this._rescaleFrame) cancelAnimationFrame(this._rescaleFrame);
        this._rescaleFrame = requestAnimationFrame(() => this._rescaleVisibleTiles());
      },
      _rescaleVisibleTiles() {
        const mapRect = this._map.getContainer().getBoundingClientRect();
        const canvases = Array.from(this.getContainer().querySelectorAll("canvas")).filter((canvas) => {
          if (!canvas._hopreachElevationPixels) return false;
          const rect = canvas.getBoundingClientRect();
          return rect.right > mapRect.left && rect.left < mapRect.right && rect.bottom > mapRect.top && rect.top < mapRect.bottom;
        });
        if (!canvases.length) return;
        let min = Infinity;
        let max = -Infinity;
        for (const canvas of canvases) {
          const raw = canvas._hopreachElevationPixels;
          for (let i = 0; i < raw.length; i += 16) {
            const metres = terrariumElevation(raw[i], raw[i + 1], raw[i + 2]);
            if (metres < min) min = metres;
            if (metres > max) max = metres;
          }
        }
        if (!isFinite(min) || !isFinite(max)) return;
        if (max <= min) max = min + 1;
        const range = { min, max };
        for (const canvas of canvases) {
          const context = canvas.getContext("2d", { willReadFrequently: true });
          const image = context.createImageData(TILE_SIZE, TILE_SIZE);
          image.data.set(colorizeTerrarium(canvas._hopreachElevationPixels, range));
          context.putImageData(image, 0, 0);
        }
        this.fire("rangechange", range);
      },
    });
    return new HeatmapLayer({
      pane: options.pane || "elevationPane",
      opacity: options.opacity == null ? 0.62 : options.opacity,
      maxNativeZoom: options.maxNativeZoom || 11,
      maxZoom: options.maxZoom || 19,
      attribution: "Elevation: AWS Terrain Tiles (Terrarium)",
    });
  }

  return { colorizeTerrarium, createLayer, elevationColor, legendGradient, terrariumElevation };
});
