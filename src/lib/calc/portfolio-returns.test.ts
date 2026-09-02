import test from "node:test";
import assert from "node:assert/strict";
import { calcHoldingReturn, calcPortfolioReturn } from "./portfolio-returns.ts";
import { selectFundDisplayQuote } from "../data/quote-mode.ts";
import type { FundQuote } from "../types";

function fund(overrides: Partial<FundQuote> = {}): FundQuote {
  const base: FundQuote = {
    code: "000001", name: "测试基金", type: "基金", nav: 1.2, navDate: "2026-09-01",
    estimate: 1.25, estimatePct: 4.1667, estimateTime: "2026-09-02T07:00:00Z", dayPct: 4.1667,
    weekPct: 0, monthPct: 0, history: [1.1, 1.2], historyPoints: [], metrics: null, source: "test",
    officialNavPublished: false, valuationStatus: "live_estimate", estimateConfidence: "high",
    historyMae20: null, historySample20: 2, historyMaxError: null, historyP95Error: null, historyMae5: null,
  };
  return { ...base, ...overrides };
}

test("holding return uses previous official NAV for today's P&L", () => {
  const result = calcHoldingReturn({ code: "000001", name: "测试基金", shares: 10, cost: 1 }, fund(), new Date("2026-09-02T02:00:00Z"));
  assert.equal(result.costValue, 10);
  assert.equal(result.marketValue, 12.5);
  assert.equal(Number(result.holdingPnl?.toFixed(4)), 2.5);
  assert.equal(Number(result.todayPnl?.toFixed(4)), 0.5);
});

test("same-day estimate remains the displayed quote after close until official NAV is published", () => {
  const now = new Date("2026-09-02T07:30:00Z");
  const result = selectFundDisplayQuote(fund(), now);
  assert.equal(result.mode, "live_estimate");
  assert.equal(result.price, 1.25);
  assert.equal(result.pct, 4.1667);
  assert.match(result.label, /今日估值/);
});

test("official NAV immediately overrides same-day estimate once published", () => {
  const now = new Date("2026-09-02T08:00:00Z");
  const result = selectFundDisplayQuote(fund({ nav: 1.24, navDate: "2026-09-02", dayPct: 4, officialNavPublished: true, valuationStatus: "official_nav" }), now);
  assert.equal(result.mode, "official_today");
  assert.equal(result.price, 1.24);
  assert.equal(result.pct, 4);
});

test("estimate equal to the latest official NAV still uses that NAV as today's baseline", () => {
  const result = calcHoldingReturn({ code: "000001", name: "测试基金", shares: 10, cost: 1 }, fund({ estimate: 1.2, estimatePct: 0, dayPct: 0 }), new Date("2026-09-02T02:00:00Z"));
  assert.equal(result.marketValue, 12);
  assert.equal(result.todayPnl, 0);
  assert.equal(result.todayPnlPct, 0);
});

test("low-confidence intraday estimate is not displayed while the market is open", () => {
  const result = calcHoldingReturn(
    { code: "000001", name: "测试基金", shares: 10, cost: 1 },
    fund({ estimateConfidence: "low", estimateTime: "2026-09-02T02:00:00Z" }),
    new Date("2026-09-02T02:30:00Z"),
  );
  assert.equal(result.marketValue, null);
  assert.equal(result.quoteMode, "none");
});

test("stale medium/high-confidence estimate is not displayed while the market is open", () => {
  const result = calcHoldingReturn(
    { code: "000001", name: "测试基金", shares: 10, cost: 1 },
    fund({ estimateConfidence: "high", estimateTime: "2026-09-02T01:00:00Z" }),
    new Date("2026-09-02T02:30:00Z"),
  );
  assert.equal(result.marketValue, null);
  assert.equal(result.quoteMode, "none");
});

test("medium/high confidence intraday estimate remains eligible when fresh", () => {
  for (const confidence of ["medium", "high"] as const) {
    const result = calcHoldingReturn(
      { code: "000001", name: "测试基金", shares: 10, cost: 1 },
      fund({ estimateConfidence: confidence, estimateTime: "2026-09-02T02:20:00Z" }),
      new Date("2026-09-02T02:30:00Z"),
    );
    assert.equal(result.quoteMode, "live_estimate");
    assert.equal(result.marketValue, 12.5);
  }
});

test("latest official NAV is not used as an intraday price when the market is open and no estimate exists", () => {
  const result = calcHoldingReturn({ code: "000001", name: "测试基金", shares: 10, cost: 1 }, fund({ estimate: null, estimatePct: null, estimateTime: null, valuationStatus: "stale", navDate: "2026-09-01" }), new Date("2026-09-02T02:00:00Z"));
  assert.equal(result.marketValue, null);
  assert.equal(result.holdingPnl, null);
  assert.equal(result.holdingPnlPct, null);
  assert.equal(result.todayPnl, null);
  assert.equal(result.todayPnlPct, null);
  assert.equal(result.quoteMode, "none");
});

test("portfolio totals expose partial pricing instead of hiding known values", () => {
  const result = calcPortfolioReturn([
    { code: "000001", name: "A", shares: 10, cost: 1 },
    { code: "000002", name: "B", shares: 10, cost: 2 },
  ], {
    "000001": fund({ estimate: null, estimatePct: null, estimateTime: null, navDate: "2026-09-02", officialNavPublished: true, valuationStatus: "official_nav" }),
  }, new Date("2026-09-02T08:00:00Z"));
  assert.equal(result.totalCount, 2);
  assert.equal(result.pricedCount, 1);
  assert.equal(result.coveragePct, 50);
  assert.equal(result.costValue, 30);
  assert.equal(result.pricedCostValue, 10);
  assert.equal(result.marketValue, 12);
  assert.equal(result.holdingPnl, 2);
  assert.equal(result.holdingPnlPct, null);
  assert.equal(result.pricedHoldingPnlPct, 20);
});
