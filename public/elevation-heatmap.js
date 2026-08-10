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

  // A deliberately wide cool-to-violet palette. RF coverage uses orange ->
  // green, so neither of those hues appears here: terrain and signal remain
  // distinguishable even when both translucent layers are enabled. Extra
  // stops make modest height changes much easier to see than the old compact
  // seven-colour hypsometric ramp. The scale tops out at 2,500 m: Australia's
  // highest terrain is below that, so reserving most of the palette for
  // elevations that cannot occur there made useful differences too subtle.
  // Values above the final stop clamp to its colour. Interpolation avoids
  // contour-like bands.
  const STOPS = [
    [-500, [7, 20, 38]],
    [0, [16, 42, 86]],
    [100, [22, 78, 155]],
    [250, [18, 111, 196]],
    [500, [20, 155, 215]],
    [750, [80, 199, 232]],
    [1000, [185, 230, 242]],
    [1250, [196, 181, 253]],
    [1500, [139, 92, 246]],
    [1750, [109, 40, 217]],
    [2000, [162, 28, 175]],
    [2250, [232, 121, 249]],
    [2500, [253, 244, 255]],
  ];

  function legendGradient() {
    const low = STOPS[0][0];
    const span = STOPS[STOPS.length - 1][0] - low;
    return `linear-gradient(90deg, ${STOPS.map(([metres, color]) =>
      `rgb(${color.join(", ")}) ${((metres - low) / span * 100).toFixed(2)}%`
    ).join(", ")})`;
  }

  function elevationColor(metres) {
    let upper = 1;
    while (upper < STOPS.length && metres > STOPS[upper][0]) upper++;
    if (upper === STOPS.length) return [...STOPS[STOPS.length - 1][1]];
    const [lowM, lowColor] = STOPS[upper - 1];
    const [highM, highColor] = STOPS[upper];
    const t = Math.max(0, (metres - lowM) / (highM - lowM));
    return lowColor.map((channel, i) => Math.round(channel + (highColor[i] - channel) * t));
  }

  function colorizeTerrarium(rgba) {
    const output = rgba.slice();
    for (let i = 0; i < rgba.length; i += 4) {
      const color = elevationColor(terrariumElevation(rgba[i], rgba[i + 1], rgba[i + 2]));
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
            pixels.data.set(colorizeTerrarium(pixels.data));
            context.putImageData(pixels, 0, 0);
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
