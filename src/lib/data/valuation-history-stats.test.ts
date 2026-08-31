import assert from "node:assert/strict";
import test from "node:test";
import { summarizeValuationHistory } from "./valuation-history-stats";

test("同一交易日只统计一次，未结算样本不进入准确率", () => {
  const stats = summarizeValuationHistory("000001", [
    { code: "000001", date: "2026-08-28", absoluteErrorPctPoints: 0.2, status: "settled" },
    { code: "000001", date: "2026-08-28", absoluteErrorPctPoints: 1.9, status: "settled" },
    { code: "000001", date: "2026-08-29", absoluteErrorPctPoints: null, status: "missing_official" },
    { code: "000001", date: "2026-08-30", absoluteErrorPctPoints: 0.4, status: "settled" },
    { code: "000002", date: "2026-08-30", absoluteErrorPctPoints: 9.9, status: "settled" },
  ]);

  assert.equal(stats.sampleCount, 2);
  assert.equal(stats.maePctPoints, 0.3);
  assert.equal(stats.maxErrorPctPoints, 0.4);
  assert.deepEqual(stats.dates, ["2026-08-28", "2026-08-30"]);
});

test("最近窗口只使用已结算样本", () => {
  const samples = Array.from({ length: 25 }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return {
      code: "000002",
      date: `2026-08-${day}`,
      absoluteErrorPctPoints: index / 10,
      status: "settled" as const,
    };
  });
  samples.push({ code: "000002", date: "2026-08-31", absoluteErrorPctPoints: null, status: "missing_intraday" });

  const stats = summarizeValuationHistory("000002", samples);
  assert.equal(stats.sampleCount, 25);
  assert.equal(stats.recent5MaePctPoints, 2.2);
  assert.equal(stats.recent20MaePctPoints, 1.75);
  assert.equal(stats.p95ErrorPctPoints, 2.3);
});
