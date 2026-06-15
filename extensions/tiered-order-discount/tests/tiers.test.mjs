import assert from "node:assert/strict";
import { getTierPercentage } from "../src/tiers.js";

const cases = [
  [49.99, 0],
  [50, 5],
  [999.99, 5],
  [1000, 10],
  [4999.99, 10],
  [5000, 15],
];

for (const [subtotal, expected] of cases) {
  assert.equal(getTierPercentage(subtotal), expected);
}

console.log("Tier logic passed");
