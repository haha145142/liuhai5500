import test from "node:test";
import assert from "node:assert/strict";
import { previewHoldingEntry, quoteFromFundState } from "./holding-entry";

test("preview calculates cost, market value and pnl immediately", () => {
  const preview = previewHoldingEntry("1000", "3.2", {
    price: 3.5,
    pct: 1.2,
    label: "盘中自算估值",
    mode: "live_estimate",
  });
  assert.equal(preview.valid, true);
  assert.equal(preview.costValue, 3200);
  assert.equal(preview.marketValue, 3500);
  assert.equal(preview.pnl, 300);
  assert.equal(preview.pnlPct, 9.375);
});

test("missing quote never invents market value", () => {
  const preview = previewHoldingEntry("1000", "3.2", {
    price: null,
    pct: null,
    label: "暂无可靠行情",
    mode: "none",
  });
  assert.equal(preview.costValue, 3200);
  assert.equal(preview.marketValue, null);
  assert.equal(preview.pnl, null);
  assert.equal(preview.pnlPct, null);
});

test("trading time prefers estimate, otherwise official nav", () => {
  const live = quoteFromFundState({ estimate: 3.31, estimatePct: 1.5, nav: 3.2, dayPct: 1.1, tradeTime: true });
  assert.equal(live.mode, "live_estimate");
  assert.equal(live.price, 3.31);

  const closed = quoteFromFundState({ estimate: 3.31, estimatePct: 1.5, nav: 3.2, dayPct: 1.1, navDate: "2026-08-31", tradeTime: false });
  assert.equal(closed.mode, "official_today");
  assert.equal(closed.price, 3.2);
});
