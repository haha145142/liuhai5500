import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyAkShareSnapshotFreshness,
  rankAkShareSectorFlow,
  type AkShareSectorFlow,
} from "./akshare-sector-flow.ts";

const rows: AkShareSectorFlow[] = [
  {
    name: "半导体",
    sectorType: "industry",
    provider: "AKShare/THS",
    changePct: 1.2,
    mainNetInflow: 500_000_000,
    mainNetRatio: 4.1,
    superNetInflow: 300_000_000,
    largeNetInflow: 200_000_000,
    midNetInflow: -100_000_000,
    smallNetInflow: -50_000_000,
  },
  {
    name: "银行",
    sectorType: "industry",
    provider: "AKShare/THS",
    changePct: -0.2,
    mainNetInflow: -200_000_000,
    mainNetRatio: -1.0,
    superNetInflow: -90_000_000,
    largeNetInflow: -80_000_000,
    midNetInflow: 100_000_000,
    smallNetInflow: 70_000_000,
  },
];

test("AKShare flow ranking prefers positive main inflow", () => {
  const ranked = rankAkShareSectorFlow(rows, 2);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0]?.row.name, "半导体");
  assert.ok(ranked[0]!.score > ranked[1]!.score);
});

test("AKShare flow ranking is bounded by requested limit", () => {
  assert.equal(rankAkShareSectorFlow(rows, 1).length, 1);
});

test("same-day snapshot is live within 30 minutes on a trading day", () => {
  const now = new Date("2026-09-02T10:00:00+08:00");
  const fetched = new Date("2026-09-02T09:45:00+08:00").toISOString();
  assert.equal(classifyAkShareSnapshotFreshness("2026-09-02", fetched, now), "live");
});

test("same-day snapshot becomes recent after the live window", () => {
  const now = new Date("2026-09-02T17:00:00+08:00");
  const fetched = new Date("2026-09-02T14:30:00+08:00").toISOString();
  assert.equal(classifyAkShareSnapshotFreshness("2026-09-02", fetched, now), "recent");
});

test("weekend keeps the latest trading-day snapshot", () => {
  const now = new Date("2026-09-06T12:00:00+08:00");
  const fetched = new Date("2026-09-04T15:00:00+08:00").toISOString();
  assert.equal(classifyAkShareSnapshotFreshness("2026-09-04", fetched, now), "recent");
});

test("wrong trading date is rejected", () => {
  const now = new Date("2026-09-02T10:00:00+08:00");
  const fetched = new Date("2026-09-02T09:45:00+08:00").toISOString();
  assert.equal(classifyAkShareSnapshotFreshness("2026-09-01", fetched, now), "stale");
});

test("invalid fetchedAt is rejected", () => {
  const now = new Date("2026-09-02T10:00:00+08:00");
  assert.equal(classifyAkShareSnapshotFreshness("2026-09-02", "not-a-date", now), "stale");
});
