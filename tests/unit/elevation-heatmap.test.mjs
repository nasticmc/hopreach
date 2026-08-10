import test from "node:test";
import assert from "node:assert/strict";
import heatmap from "../../public/elevation-heatmap.js";

test("decodes Terrarium RGB elevation values", () => {
  assert.equal(heatmap.terrariumElevation(128, 0, 0), 0);
  assert.equal(heatmap.terrariumElevation(129, 244, 0), 500);
  assert.equal(heatmap.terrariumElevation(127, 255, 128), -0.5);
});

test("maps elevation to a continuous, clamped hypsometric palette", () => {
  assert.deepEqual(heatmap.elevationColor(-1000), [7, 20, 38]);
  assert.deepEqual(heatmap.elevationColor(0), [16, 42, 86]);
  assert.deepEqual(heatmap.elevationColor(500), [20, 155, 215]);
  assert.deepEqual(heatmap.elevationColor(2500), [253, 244, 255]);
  assert.deepEqual(heatmap.elevationColor(8000), [253, 244, 255]);
});

test("exposes the complete palette as a labelled-scale gradient", () => {
  const gradient = heatmap.legendGradient();
  assert.match(gradient, /^linear-gradient\(90deg,/);
  assert.equal((gradient.match(/rgb\(/g) || []).length, 13);
  assert.match(gradient, /rgb\(7, 20, 38\) 0\.00%/);
  assert.match(gradient, /rgb\(253, 244, 255\) 100\.00%/);
  assert.match(gradient, /rgb\(16, 42, 86\) 16\.67%/);
});

test("colorizes pixels while preserving source alpha", () => {
  const result = heatmap.colorizeTerrarium(new Uint8ClampedArray([128, 0, 0, 177]));
  assert.deepEqual([...result], [16, 42, 86, 177]);
});
