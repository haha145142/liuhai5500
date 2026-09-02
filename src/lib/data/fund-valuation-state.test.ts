import assert from "node:assert/strict";
import test from "node:test";
import { normalizeFundValuationState, resolveFundValuationState } from "./fund-valuation-state";

const day = new Date("2026-09-02T08:00:00Z");

test("official NAV wins immediately when published for current China date", () => {
  const q = { nav: 1.2345, navDate: "2026-09-02", estimate: 1.2401, estimateTime: "2026-09-02T07:55:00Z", officialNavPublished: true, valuationStatus: "official_nav" as const };
  assert.equal(resolveFundValuationState(q, day), "official_nav");
  const normalized = normalizeFundValuationState(q, day);
  assert.equal(normalized.estimate, null);
  assert.equal(normalized.referenceNav, 1.2345);
});

test("same-day estimate remains visible until official NAV arrives", () => {
  const q = { nav: 1.2200, navDate: "2026-09-01", estimate: 1.2380, estimateTime: "2026-09-02T07:55:00Z", officialNavPublished: false, valuationStatus: "estimate" as const };
  assert.equal(resolveFundValuationState(q, day), "same_day_estimate");
  assert.equal(normalizeFundValuationState(q, day).valuationStatus, "estimate");
});

test("old estimate is never treated as current-day data", () => {
  const q = { nav: 1.2200, navDate: "2026-09-01", estimate: 1.2380, estimateTime: "2026-09-01T07:55:00Z", officialNavPublished: false, valuationStatus: "estimate" as const };
  assert.equal(resolveFundValuationState(q, day), "latest_official");
  assert.equal(normalizeFundValuationState(q, day).estimate, null);
});
