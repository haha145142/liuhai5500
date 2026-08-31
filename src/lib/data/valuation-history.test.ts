import test from "node:test";
import assert from "node:assert/strict";
import { summarizeValuationHistory } from "./valuation-history.ts";

test("summarizes absolute calibration error only from usable samples", () => {
  const r = summarizeValuationHistory([
    { code: "000001", date: "2026-08-28", observedAt: "09:40", calculatedPct: 1, referencePct: 1.2, deviationPctPoints: 0.2, coveragePct: 80, calibration: "aligned", confidence: "high" },
    { code: "000001", date: "2026-08-29", observedAt: "10:20", calculatedPct: 0.5, referencePct: 1.1, deviationPctPoints: 0.6, coveragePct: 55, calibration: "close", confidence: "medium" },
    { code: "000001", date: "2026-08-30", observedAt: "11:10", calculatedPct: null, referencePct: null, deviationPctPoints: null, coveragePct: 20, calibration: "insufficient", confidence: "low" },
  ]);
  assert.equal(r.samples, 2);
  assert.ok(Math.abs((r.meanAbsDeviation ?? 0) - 0.4) < 1e-12);
  assert.equal(r.maxAbsDeviation, 0.6);
});

test("empty history has no fabricated accuracy figure", () => {
  const r = summarizeValuationHistory([]);
  assert.equal(r.samples, 0);
  assert.equal(r.meanAbsDeviation, null);
  assert.equal(r.maxAbsDeviation, null);
});
