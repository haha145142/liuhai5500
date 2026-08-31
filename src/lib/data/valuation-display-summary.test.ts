import assert from "node:assert/strict";
import test from "node:test";
import { summarizeValuation } from "./valuation-display-summary";

test("official nav is authoritative", () => {
  assert.equal(summarizeValuation({ mode: "official_nav" }).title, "官方净值");
});

test("high confidence estimate includes validation context", () => {
  const result = summarizeValuation({
    mode: "estimate",
    estimateConfidence: "high",
    coveragePct: 82,
    crossCheckedWeightPct: 68,
    historicalMaePctPoints: 0.28,
    historicalSampleCount: 20,
  });
  assert.match(result.title, /已校验/);
  assert.match(result.detail, /覆盖 82%/);
  assert.match(result.detail, /近20日误差 0\.28/);
});

test("medium and low confidence are not presented as confirmed", () => {
  assert.match(summarizeValuation({ mode: "estimate", estimateConfidence: "medium" }).title, /需观察/);
  assert.match(summarizeValuation({ mode: "estimate", estimateConfidence: "low" }).title, /低置信度/);
});

test("missing modes are explicit", () => {
  assert.equal(summarizeValuation({ mode: "unavailable" }).title, "暂无可靠行情");
  assert.equal(summarizeValuation({ mode: "waiting_official_nav" }).title, "等待官方净值");
});
