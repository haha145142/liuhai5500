import test from "node:test";
import assert from "node:assert/strict";
import { calcHoldingReturn } from "./portfolio-returns.ts";
import type { FundQuote } from "../types";

function fund(): FundQuote {
  return {
    code: "000001", name: "回归测试基金", type: "基金", nav: 1.2, navDate: "2026-09-04",
    estimate: null, estimatePct: null, estimateTime: null, dayPct: 0,
    weekPct: 0, monthPct: 0, history: [1.1, 1.2],
    historyPoints: [
      { date: "2026-09-03", nav: 1.1, changePct: null },
      { date: "2026-09-04", nav: 1.2, changePct: 9.09 },
    ],
    metrics: null, source: "test", officialNavPublished: true, valuationStatus: "official_nav",
    estimateConfidence: "high", historyMae20: null, historySample20: 2, historyMaxError: null,
    historyP95Error: null, historyMae5: null,
  };
}

test("previous trading day's official NAV is not mislabeled as today's P&L on a weekend", () => {
  const result = calcHoldingReturn(
    { code: "000001", name: "回归测试基金", shares: 10, cost: 1 },
    fund(),
    new Date("2026-09-06T04:00:00Z"),
  );
  assert.equal(result.quoteMode, "latest_official");
  assert.equal(result.marketValue, 12);
  assert.equal(result.todayPnl, null);
  assert.equal(result.todayPnlPct, null);
});
