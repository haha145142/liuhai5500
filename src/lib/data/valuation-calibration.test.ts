import test from "node:test";
import assert from "node:assert/strict";
import { calibrateValuation } from "./valuation-calibration.ts";

test("high coverage and small deviation are aligned", () => {
  const r = calibrateValuation(1.2, 1.35, 82);
  assert.equal(r.band, "aligned");
  assert.equal(r.confidence, "high");
});

test("medium coverage with moderate deviation is close", () => {
  const r = calibrateValuation(1.2, 1.9, 55);
  assert.equal(r.band, "close");
  assert.equal(r.confidence, "medium");
});

test("large deviation is never promoted", () => {
  const r = calibrateValuation(1.2, 2.4, 90);
  assert.equal(r.band, "diverged");
  assert.equal(r.confidence, "low");
});

test("missing reference keeps validation insufficient", () => {
  const r = calibrateValuation(1.2, null, 90);
  assert.equal(r.band, "insufficient");
  assert.equal(r.confidence, "low");
});
