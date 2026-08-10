import test from "node:test";
import assert from "node:assert/strict";
import heatmap from "../../public/elevation-heatmap.js";

test("decodes Terrarium RGB elevation values", () => {
  assert.equal(heatmap.terrariumElevation(128, 0, 0), 0);
  assert.equal(heatmap.terrariumElevation(129, 244, 0), 500);
  assert.equal(heatmap.terrariumElevation(127, 255, 128), -0.5);
});

test("maps elevation to a continuous, clamped hypsometric palette", () => {
  assert.deepEqual(heatmap.elevationColor(-1000), [22, 50, 73]);
  assert.deepEqual(heatmap.elevationColor(0), [45, 92, 79]);
  assert.deepEqual(heatmap.elevationColor(500), [134, 147, 89]);
  assert.deepEqual(heatmap.elevationColor(6000), [255, 255, 255]);
});

test("exposes the complete palette as a labelled-scale gradient", () => {
  const gradient = heatmap.legendGradient();
  assert.match(gradient, /^linear-gradient\(90deg,/);
  assert.equal((gradient.match(/rgb\(/g) || []).length, 7);
  assert.match(gradient, /rgb\(22, 50, 73\) 0\.00%/);
  assert.match(gradient, /rgb\(255, 255, 255\) 100\.00%/);
  assert.match(gradient, /rgb\(45, 92, 79\) 9\.09%/);
});

test("colorizes pixels while preserving source alpha", () => {
  const result = heatmap.colorizeTerrarium(new Uint8ClampedArray([128, 0, 0, 177]));
  assert.deepEqual([...result], [45, 92, 79, 177]);
});

test("stretches colours across a supplied viewport range", () => {
  assert.deepEqual(heatmap.elevationColor(100, { min: 100, max: 300 }), [22, 50, 73]);
  assert.deepEqual(heatmap.elevationColor(300, { min: 100, max: 300 }), [255, 255, 255]);
});
