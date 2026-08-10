import test from "node:test";
import assert from "node:assert/strict";
import filter from "../../public/node-filter.js";

const nodes = [
  { name: "Ben Nevis", public_key: "A1B2C3", status: "active", observed_scopes: ["Highlands"] },
  { name: "Harbour", public_key: "D4E5F6", status: "silent", observed_scopes: [] },
];

test("searches node names, keys, and coverage scopes case-insensitively", () => {
  assert.equal(filter.matches(nodes[0], { query: "nevis" }), true);
  assert.equal(filter.matches(nodes[0], { query: "a1b2" }), true);
  assert.equal(filter.matches(nodes[0], { query: "highLAND" }), true);
  assert.equal(filter.matches(nodes[1], { query: "highland" }), false);
});

test("combines status and scope filters and supports unscoped nodes", () => {
  assert.equal(filter.matches(nodes[0], { statuses: ["active"], scopes: ["Highlands"] }), true);
  assert.equal(filter.matches(nodes[1], { statuses: ["active"], scopes: [] }), false);
  assert.equal(filter.matches(nodes[1], { statuses: [], scopes: ["unscoped"] }), true);
});
