import assert from "node:assert/strict";
import test from "node:test";
import { getMarketPhase } from "./market-hours.ts";

function cst(s: string) { return new Date(`${s}+08:00`); }

test("market clock follows A-share sessions", () => {
  assert.equal(getMarketPhase(cst("2026-08-31T09:29:00")), "preopen");
  assert.equal(getMarketPhase(cst("2026-08-31T10:00:00")), "morning");
  assert.equal(getMarketPhase(cst("2026-08-31T12:00:00")), "lunch");
  assert.equal(getMarketPhase(cst("2026-08-31T14:00:00")), "afternoon");
  assert.equal(getMarketPhase(cst("2026-08-31T16:00:00")), "postclose");
});

test("weekend and exchange holiday are non-trading phases", () => {
  assert.equal(getMarketPhase(cst("2026-08-29T10:00:00")), "weekend");
  assert.equal(getMarketPhase(cst("2026-10-01T10:00:00")), "weekend");
});
