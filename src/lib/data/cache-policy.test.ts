import assert from "node:assert/strict";
import test from "node:test";
import { CACHE_TTL_MS, cacheTtl, classifyMarketDataState, marketDataLabel } from "./cache-policy";

test("cache TTLs stay field-specific", () => {
  assert.equal(cacheTtl("index"), 15_000);
  assert.equal(cacheTtl("fundEstimate"), 25_000);
  assert.equal(cacheTtl("fundSector"), 60_000);
  assert.equal(cacheTtl("news"), 180_000);
  assert.equal(cacheTtl("officialNav"), 3_600_000);
  assert.equal(CACHE_TTL_MS.portfolio, 300_000);
});

test("market cache state uses China calendar date semantics", () => {
  const fridayNightUtc = new Date("2026-09-04T15:30:00Z");
  assert.equal(classifyMarketDataState({ now: fridayNightUtc, latestTradingDate: "2026-09-04" }), "trading");
  const saturday = new Date("2026-09-05T04:00:00Z");
  assert.equal(classifyMarketDataState({ now: saturday, latestTradingDate: "2026-09-04" }), "weekend");
  assert.match(marketDataLabel("weekend", "2026-09-04"), /2026-09-04/);
});
