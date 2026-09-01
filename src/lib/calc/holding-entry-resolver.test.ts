import test from "node:test";
import assert from "node:assert/strict";
import { resolveHoldingEntryPreview } from "./holding-entry-resolver.ts";

const fund = {
  code: "000001",
  name: "测试基金",
  nav: 1.2,
  navDate: "2026-08-28",
  dayPct: 0.8,
  estimate: null,
  estimatePct: null,
} as any;

test("trading mode never falls back to stale NAV", () => {
  const result = resolveHoldingEntryPreview(
    { code: "000001", shares: 1000, cost: 1.1 },
    { "000001": fund },
    true,
  );

  assert.equal(result.marketLabel, "暂无可靠行情");
  assert.equal(result.price, null);
  assert.equal(result.marketValue, null);
  assert.equal(result.pnl, null);
});

test("closed mode uses official NAV", () => {
  const result = resolveHoldingEntryPreview(
    { code: "000001", shares: 1000, cost: 1.1 },
    { "000001": fund },
    false,
  );

  assert.equal(result.marketLabel, "今日官方净值");
  assert.equal(result.price, 1.2);
  assert.equal(result.marketValue, 1200);
  assert.equal(result.pnl, 100);
});
