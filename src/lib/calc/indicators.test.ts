import test from "node:test";
import assert from "node:assert/strict";
import { calcIndicators, calcSwingTrade } from "./indicators";

function series(n: number, step: number, wobble = 0.12) {
  return Array.from({ length: n }, (_, i) => 1 + i * step + Math.sin(i / 3) * wobble);
}

test("indicator engine returns complete band/trend scores with enough history", () => {
  const metrics = calcIndicators(series(80, 0.002));
  assert.ok(metrics);
  assert.equal(Number.isFinite(metrics.bandScore), true);
  assert.equal(Number.isFinite(metrics.trendScore), true);
  assert.equal(Number.isFinite(metrics.rsi), true);
  assert.equal(Number.isFinite(metrics.macd), true);
  assert.ok(metrics.band.length > 0);
  assert.ok(metrics.trend.length > 0);
  assert.ok(metrics.combo.length > 0);
  assert.ok(Array.isArray(metrics.sigConds));
});

test("short history never produces a false trading signal", () => {
  assert.equal(calcIndicators(series(20, 0.002)), null);
  assert.equal(calcSwingTrade(null, 1, 1), null);
});

test("invalid valuation/cost never produces trade grids", () => {
  const metrics = calcIndicators(series(80, 0.001));
  assert.ok(metrics);
  assert.equal(calcSwingTrade(metrics, 0, 1), null);
  assert.equal(calcSwingTrade(metrics, 1, 0), null);
  assert.equal(calcSwingTrade(metrics, 1, Number.NaN), null);
});

test("valid metrics and validated price produce bounded, finite trade advice", () => {
  const metrics = calcIndicators(series(100, 0.001));
  assert.ok(metrics);
  const advice = calcSwingTrade(metrics, 1.1, 1.2);
  assert.ok(advice);
  assert.equal(Number.isFinite(advice.env), true);
  assert.ok(advice.env >= 0 && advice.env <= 100);
  assert.equal(Number.isFinite(advice.buyGrid ?? 0), true);
  assert.equal(Number.isFinite(advice.sellGrid ?? 0), true);
  assert.ok(advice.reason.length > 0);
});
