import test from "node:test";
import assert from "node:assert/strict";
import { calcDailyPortfolioPnl, calcPortfolioPeriodReturn } from "./portfolio-periods.ts";

const baseFund = {
  code: "000001", name: "测试基金", type: "基金", nav: 1.4, navDate: "2026-08-28",
  estimate: 1.5, estimatePct: 7.14, estimateTime: "10:00", dayPct: 7.14, weekPct: 0, monthPct: 0,
  history: [1.0, 1.1, 1.2, 1.3, 1.4],
  historyPoints: [
    { date: "2026-08-24", nav: 1.1, changePct: null },
    { date: "2026-08-25", nav: 1.2, changePct: 9.09 },
    { date: "2026-08-26", nav: 1.3, changePct: 8.33 },
    { date: "2026-08-28", nav: 1.4, changePct: 7.69 },
  ],
  metrics: null, source: "test", officialNavPublished: false,
  valuationStatus: "estimate" as const, estimateConfidence: "high" as const,
  historyMae20: null, historySample20: 4, historyMaxError: null, historyP95Error: null, historyMae5: null,
};

test("weekly period uses calendar start, not a fixed trading-day count", () => {
  const result = calcPortfolioPeriodReturn(
    "week",
    [{ code: "000001", name: "测试基金", shares: 10, cost: 1 }],
    { "000001": baseFund },
    new Date(2026, 7, 28),
  );
  assert.equal(result.amount, 3);
  assert.equal(result.baseDate, "2026-08-24");
});

test("daily P&L uses official NAV changes only", () => {
  const result = calcDailyPortfolioPnl(
    "2026-08-25",
    [{ code: "000001", name: "测试基金", shares: 10, cost: 1 }],
    { "000001": baseFund },
  );
  assert.equal(result.amount, 1);
  assert.equal(result.coveredFunds, 1);
});
