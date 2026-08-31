import test from "node:test";
import assert from "node:assert/strict";
import { calcPortfolioPeriodReturn, calcStandardPortfolioPeriods } from "./period-returns.ts";

test("calendar-based week uses the first available trading day in the current week", () => {
  const result = calcPortfolioPeriodReturn(
    [{ code: "000001", name: "A", shares: 10, cost: 1 }],
    {
      "000001": {
        code: "000001", name: "A", type: "基金", nav: 1.3, navDate: "2026-08-28", estimate: null,
        estimatePct: null, estimateTime: null, dayPct: null, weekPct: null, monthPct: null,
        history: [1.2, 1.25, 1.3],
        historyPoints: [
          { date: "2026-08-24", nav: 1.2, changePct: null },
          { date: "2026-08-25", nav: 1.25, changePct: null },
          { date: "2026-08-28", nav: 1.3, changePct: null },
        ],
        metrics: null, source: "test", officialNavPublished: true, valuationStatus: "official_nav", estimateConfidence: "high",
        historyMae20: null, historySample20: 3, historyMaxError: null, historyP95Error: null, historyMae5: null,
      },
    },
    "week",
    new Date("2026-08-28T12:00:00+08:00"),
  );

  assert.equal(result.pricedCount, 1);
  assert.equal(result.baseDate, "2026-08-24");
  assert.equal(result.currentDate, "2026-08-28");
  assert.equal(Number(result.amount?.toFixed(4)), 1);
  assert.equal(Number(result.pct?.toFixed(4)), Number(((1 / 12) * 100).toFixed(4)));
});

test("standard periods have exactly week/month/year semantics", () => {
  const result = calcStandardPortfolioPeriods([], {}, new Date("2026-08-28T12:00:00+08:00"));
  assert.deepEqual(result.map((x) => x.key), ["week", "month", "year"]);
  assert.ok(result.every((x) => x.amount === null && x.pct === null));
});
