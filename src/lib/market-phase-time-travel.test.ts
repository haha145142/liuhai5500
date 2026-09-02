import assert from "node:assert/strict";
import test from "node:test";
import { getMarketPhase } from "./market-hours";

const at = (utc: string) => new Date(utc);

test("market phase covers the full China trading day boundary", () => {
  assert.equal(getMarketPhase(at("2026-09-01T00:00:00Z")), "preopen"); // 08:00 CST
  assert.equal(getMarketPhase(at("2026-09-01T01:29:00Z")), "preopen"); // 09:29
  assert.equal(getMarketPhase(at("2026-09-01T01:30:00Z")), "morning"); // 09:30
  assert.equal(getMarketPhase(at("2026-09-01T03:30:00Z")), "morning"); // 11:30
  assert.equal(getMarketPhase(at("2026-09-01T03:31:00Z")), "lunch"); // 11:31
  assert.equal(getMarketPhase(at("2026-09-01T05:00:00Z")), "afternoon"); // 13:00
  assert.equal(getMarketPhase(at("2026-09-01T07:00:00Z")), "afternoon"); // 15:00
  assert.equal(getMarketPhase(at("2026-09-01T07:01:00Z")), "postclose"); // 15:01
});

test("weekend is always non-trading regardless of clock time", () => {
  assert.equal(getMarketPhase(at("2026-09-05T01:30:00Z")), "weekend");
  assert.equal(getMarketPhase(at("2026-09-06T07:00:00Z")), "weekend");
});
