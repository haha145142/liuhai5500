import test from "node:test";
import assert from "node:assert/strict";
import { buildValuationDisplaySummary } from "./valuation-display";

test("old quote shape remains safe without history fields", () => {
  const summary = buildValuationDisplaySummary({
    valuationStatus: "official_nav",
    estimateConfidence: null,
    estimateCoverage: null,
    estimateValidation: null,
  });
  assert.equal(summary.mode, "官方净值");
  assert.equal(summary.history, "历史样本不足");
});

test("20-day history is shown only after five settled samples", () => {
  const enough = buildValuationDisplaySummary({
    valuationStatus: "estimate",
    estimateConfidence: "high",
    estimateCoverage: 78,
    estimateValidation: "一致",
    historyMae20: 0.28,
    historySample20: 5,
  });
  assert.equal(enough.history, "20日MAE 0.28%");

  const insufficient = buildValuationDisplaySummary({
    valuationStatus: "estimate",
    estimateConfidence: "high",
    estimateCoverage: 78,
    estimateValidation: "一致",
    historyMae20: 0.10,
    historySample20: 4,
  });
  assert.equal(insufficient.history, "历史样本不足");
});
