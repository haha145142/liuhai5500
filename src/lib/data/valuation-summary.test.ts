import test from "node:test";
import assert from "node:assert/strict";
import { summarizeValuationHistory } from "./valuation-summary";

test("summarizeValuationHistory ignores unsettled rows and deduplicates date", () => {
  const summary = summarizeValuationHistory([
    { code: "000001", date: "2026-08-28", absoluteErrorPctPoints: 0.2, status: "settled" },
    { code: "000001", date: "2026-08-28", absoluteErrorPctPoints: 0.4, status: "settled" },
    { code: "000001", date: "2026-08-29", absoluteErrorPctPoints: null, status: "missing_official" },
    { code: "000002", date: "2026-08-29", absoluteErrorPctPoints: 0.6, status: "settled" },
  ]);
  assert.equal(summary.sampleCount, 2);
  assert.equal(summary.maxErrorPctPoints, 0.6);
  assert.equal(summary.recent5MaePctPoints, 0.5);
});

test("insufficient history is not promoted to stable by one good sample", () => {
  const summary = summarizeValuationHistory([
    { code: "000001", date: "2026-08-28", absoluteErrorPctPoints: 0.1, status: "settled" },
  ]);
  assert.equal(summary.sampleCount, 1);
  assert.equal(summary.rating, "insufficient");
});
