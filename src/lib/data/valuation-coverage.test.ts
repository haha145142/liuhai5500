import test from "node:test";
import assert from "node:assert/strict";
import { assessValuationCoverage } from "./valuation-coverage.ts";

test("high coverage keeps the raw weighted contribution", () => {
  const r = assessValuationCoverage(1.25, 68, 80);
  assert.equal(r.effectivePct, 1.25);
  assert.equal(r.confidence, "high");
});

test("missing holdings do not get fabricated as zero contribution", () => {
  const r = assessValuationCoverage(-0.8, 18, 72);
  assert.equal(r.effectivePct, -0.8);
  assert.equal(r.confidence, "low");
});

test("no usable holdings means no estimate", () => {
  const r = assessValuationCoverage(0.5, 0, 60);
  assert.equal(r.effectivePct, null);
  assert.equal(r.confidence, "low");
});
