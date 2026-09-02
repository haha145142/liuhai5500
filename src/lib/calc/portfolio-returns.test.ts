import test from "node:test";
import assert from "node:assert/strict";
import { calcHoldingReturn, calcPortfolioReturn } from "./portfolio-returns.ts";

test("holding return uses previous official NAV for today's P&L", () => {
  const result = calcHoldingReturn(
    { code: "000001", name: "测试基金", shares: 10, cost: 1 },
    {
      code: "000001",
      name: "测试基金",
      type: "基金",
      nav: 1.2,
      navDate: "2026-08-31",
      estimate: 1.25,
      estimatePct: 4.1667,
      estimateTime: "10:00",
      dayPct: 4.1667,
      weekPct: 0,
      monthPct: 0,
      history: [1.1, 1.2],
      historyPoints: [],
      metrics: null,
      source: "test",
      officialNavPublished: false,
      valuationStatus: "live_estimate",
      estimateConfidence: "high",
      historyMae20: null,
      historySample20: 2,
      historyMaxError: null,
      historyP95Error: null,
      historyMae5: null,
    },
  );

  assert.equal(result.costValue, 10);
  assert.equal(result.marketValue, 12.5);
  assert.equal(Number(result.holdingPnl?.toFixed(4)), 2.5);
  assert.equal(Number(result.todayPnl?.toFixed(4)), 0.5);
});

test("latest official NAV is not used as an intraday price when the market is open", () => {
  const result = calcHoldingReturn(
    { code: "000001", name: "测试基金", shares: 10, cost: 1 },
    {
      code: "000001",
      name: "测试基金",
      type: "基金",
      nav: 1.2,
      navDate: "2026-08-28",
      estimate: null,
      estimatePct: null,
      estimateTime: null,
      dayPct: 0,
      weekPct: 0,
      monthPct: 0,
      history: [1.1, 1.2],
      historyPoints: [],
      metrics: null,
      source: "test",
      officialNavPublished: false,
      valuationStatus: "stale",
      estimateConfidence: "low",
      historyMae20: null,
      historySample20: 2,
      historyMaxError: null,
      historyP95Error: null,
      historyMae5: null,
    },
  );

  assert.equal(result.marketValue, null);
  assert.equal(result.holdingPnl, null);
  assert.equal(result.holdingPnlPct, null);
  assert.equal(result.todayPnl, null);
  assert.equal(result.todayPnlPct, null);
  assert.equal(result.quoteMode, "none");
});

test("portfolio totals remain available when one fund is missing a quote", () => {
  const result = calcPortfolioReturn(
    [
      { code: "000001", name: "A", shares: 10, cost: 1 },
      { code: "000002", name: "B", shares: 10, cost: 2 },
    ],
    {
      "000001": {
        code: "000001", name: "A", type: "基金", nav: 1.2, navDate: "2026-08-31", estimate: null,
        estimatePct: null, estimateTime: null, dayPct: 0, weekPct: 0, monthPct: 0, history: [1.1, 1.2],
        historyPoints: [], metrics: null, source: "test", officialNavPublished: true, valuationStatus: "official_nav",
        estimateConfidence: "high", historyMae20: null, historySample20: 2, historyMaxError: null, historyP95Error: null, historyMae5: null,
      },
    },
  );

  assert.equal(result.totalCount, 2);
  assert.equal(result.pricedCount, 1);
  assert.equal(result.costValue, 30);
  assert.equal(result.marketValue, 12);
  assert.equal(result.holdingPnl, 2);
  assert.equal(result.holdingPnlPct, null);
});
