import test from "node:test";
import assert from "node:assert/strict";
import { assessNewsEvidence } from "./news-evidence";

test("event alone is not verified", () => {
  const r = assessNewsEvidence({ publishedAt: Date.now(), sourceUrl: "https://example.com", relatedSector: true });
  assert.equal(r.level, "event_only");
});

test("sector move alone is only corroborating evidence", () => {
  const r = assessNewsEvidence({
    publishedAt: Date.now(),
    sourceUrl: "https://example.com",
    relatedSector: true,
    sectorPct: 1.2,
    sectorValidation: "single_source",
  });
  assert.equal(r.level, "corroborated");
});

test("cross-checked market plus flow can be verified", () => {
  const r = assessNewsEvidence({
    publishedAt: Date.now(),
    sourceUrl: "https://example.com",
    relatedSector: true,
    sectorPct: 1.2,
    sectorValidation: "cross_checked",
    indexPct: 0.5,
    moneyFlow: 1230000,
  });
  assert.equal(r.level, "verified");
});

test("missing evidence does not become a directional conclusion", () => {
  const r = assessNewsEvidence({ publishedAt: null, relatedSector: false });
  assert.equal(r.level, "insufficient");
});
