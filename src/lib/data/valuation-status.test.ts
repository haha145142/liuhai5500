import test from "node:test";
import assert from "node:assert/strict";
import { valuationDisplay } from "./valuation-status.ts";

test("official NAV wins once published", () => {
  const r = valuationDisplay({ officialNavPublished: true, estimatePct: 1.4, coveragePct: 90, validation: "一致", hasNav: true });
  assert.equal(r.status, "official_nav");
});

test("validated intraday estimate is explicit", () => {
  const r = valuationDisplay({ officialNavPublished: false, estimatePct: 1.4, coveragePct: 75, validation: "一致", hasNav: true });
  assert.equal(r.status, "estimated_cross_checked");
});

test("no estimate never falls back to stale NAV intraday", () => {
  const r = valuationDisplay({ officialNavPublished: false, estimatePct: null, coveragePct: 80, validation: "无法验证", hasNav: true });
  assert.equal(r.status, "waiting_official_nav");
});

test("very low coverage is marked low coverage", () => {
  const r = valuationDisplay({ officialNavPublished: false, estimatePct: 0.3, coveragePct: 20, validation: "轻微偏差", hasNav: true });
  assert.equal(r.status, "estimated_low_coverage");
});
