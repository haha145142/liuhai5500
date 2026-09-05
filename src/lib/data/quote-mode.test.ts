import assert from "node:assert/strict";
import test from "node:test";
import { selectFundDisplayQuote } from "./quote-mode.ts";
import type { FundQuote } from "../types.ts";

const base: FundQuote = {
  code: "000001",
  name: "测试基金",
  type: "混合型",
  nav: 1.2,
  navDate: "2026-09-02",
  estimate: null,
  estimatePct: null,
  estimateTime: null,
  dayPct: 1.2,
  weekPct: null,
  monthPct: null,
  history: [],
  historyPoints: [],
  metrics: null,
  source: "test",
};

test("same-day NAV is not official without explicit publication flag", () => {
  const result = selectFundDisplayQuote(
    { ...base, officialNavPublished: false, valuationStatus: "waiting_official_nav" },
    new Date("2026-09-02T08:30:00Z"),
  );
  assert.notEqual(result.mode, "official_today");
  assert.equal(result.mode, "latest_official");
});

test("same-day NAV becomes official only after explicit publication", () => {
  const result = selectFundDisplayQuote(
    { ...base, officialNavPublished: true, valuationStatus: "official_nav" },
    new Date("2026-09-02T08:30:00Z"),
  );
  assert.equal(result.mode, "official_today");
  assert.equal(result.price, 1.2);
});

test("fresh medium-confidence intraday estimate is displayed while market is open", () => {
  const result = selectFundDisplayQuote(
    {
      ...base,
      navDate: "2026-09-01",
      estimate: 1.215,
      estimatePct: 1.25,
      estimateTime: "2026-09-02T01:40:00Z",
      officialNavPublished: false,
      valuationStatus: "estimate",
      estimateConfidence: "medium",
    },
    new Date("2026-09-02T01:45:00Z"),
  );
  assert.equal(result.mode, "live_estimate");
  assert.equal(result.price, 1.215);
});

test("stale intraday estimate falls back instead of being shown as live", () => {
  const result = selectFundDisplayQuote(
    {
      ...base,
      navDate: "2026-09-01",
      estimate: 1.215,
      estimatePct: 1.25,
      estimateTime: "2026-09-02T00:00:00Z",
      officialNavPublished: false,
      valuationStatus: "estimate",
      estimateConfidence: "high",
    },
    new Date("2026-09-02T01:45:00Z"),
  );
  assert.notEqual(result.mode, "live_estimate");
  assert.equal(result.mode, "latest_official");
});
