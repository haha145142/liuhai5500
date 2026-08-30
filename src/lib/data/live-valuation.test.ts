import test from "node:test";
import assert from "node:assert/strict";

function calc(
  nav: number,
  holdings: Array<{ weight: number; pct: number | null }>,
  externalPct: number | null = null,
) {
  const totalDisclosed = holdings.reduce((s, h) => s + Math.max(0, h.weight), 0);
  const usable = holdings.filter((h) => h.weight > 0 && h.pct != null);
  const usableWeight = usable.reduce((s, h) => s + h.weight, 0);
  if (usableWeight <= 0 || totalDisclosed <= 0) {
    return { estimate: null, pct: null, coverage: 0, deviation: null };
  }
  const pct = usable.reduce((s, h) => s + h.weight * (h.pct as number), 0) / 100;
  return {
    estimate: nav * (1 + pct / 100),
    pct,
    coverage: usableWeight,
    deviation: externalPct == null ? null : Math.abs(pct - externalPct),
  };
}

test("uses disclosed weight contribution and does not amplify top-ten holdings", () => {
  const r = calc(1, [
    { weight: 20, pct: 5 },
    { weight: 20, pct: -5 },
  ]);
  assert.equal(r.pct, 0);
  assert.equal(r.estimate, 1);
  assert.equal(r.coverage, 40);
});

test("missing constituent quotes reduce usable coverage but do not become fake zero-weight holdings", () => {
  const r = calc(2, [
    { weight: 30, pct: 4 },
    { weight: 20, pct: null },
  ]);
  assert.equal(r.coverage, 30);
  assert.equal(r.pct, 1.2);
  assert.ok(Math.abs((r.estimate ?? 0) - 2.024) < 1e-12);
});

test("external estimate is validation-only", () => {
  const r = calc(1, [{ weight: 50, pct: 4 }], 1.8);
  assert.equal(r.pct, 2);
  assert.equal(r.deviation, 0.2);
});
