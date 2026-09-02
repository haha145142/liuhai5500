import { describe, expect, it } from "vitest";
import { inferHoldingEntryDate } from "./holding-entry-date";

describe("inferHoldingEntryDate", () => {
  const points = [
    { date: "2026-05-08", nav: 2.68, changePct: 0.2 },
    { date: "2026-05-11", nav: 2.7008, changePct: 0.77 },
    { date: "2026-05-12", nav: 2.74, changePct: 1.45 },
  ];

  it("selects the closest historical NAV and computes holding days", () => {
    const result = inferHoldingEntryDate(points, 2.7008, new Date("2026-09-02T12:00:00+08:00"));
    expect(result.date).toBe("2026-05-11");
    expect(result.days).toBe(114);
    expect(result.confidence).toBe("high");
    expect(result.nav).toBe(2.7008);
  });

  it("does not claim an exact date when cost is too far from history", () => {
    const result = inferHoldingEntryDate(points, 3.2, new Date("2026-09-02T12:00:00+08:00"));
    expect(result.date).toBeNull();
    expect(result.days).toBeNull();
    expect(result.confidence).toBe("none");
  });

  it("returns none for invalid input", () => {
    expect(inferHoldingEntryDate([], 2.7)).toEqual({ date: null, days: null, nav: null, distancePct: null, confidence: "none" });
  });
});
