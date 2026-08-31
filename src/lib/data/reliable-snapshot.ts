import type { Snapshot } from "../types";

let lastGoodSnapshot: Snapshot | null = null;

function hasIndexData(snapshot: Snapshot) {
  return snapshot.indices.some((item) => item.price != null || item.pct != null);
}
function hasSectorData(snapshot: Snapshot) {
  return snapshot.sectors.some((item) => item.change != null || item.flow != null);
}
function hasGlobalData(snapshot: Snapshot) {
  return snapshot.global.some((item) => item.price != null || item.pct != null);
}
function hasFlowData(snapshot: Snapshot) {
  const flow = snapshot.flow;
  return !!flow && [flow.main, flow.super, flow.large, flow.mid, flow.small].every((v) => Number.isFinite(v));
}

/**
 * Preserve the last usable module-level snapshot so a transient upstream
 * failure cannot blank previously valid data.
 */
export function preserveReliableSnapshot(current: Snapshot): Snapshot {
  if (!lastGoodSnapshot) {
    if (hasIndexData(current) || hasSectorData(current) || hasGlobalData(current) || hasFlowData(current)) {
      lastGoodSnapshot = current;
    }
    return current;
  }

  const merged: Snapshot = {
    ...current,
    indices: hasIndexData(current) ? current.indices : lastGoodSnapshot.indices,
    sectors: hasSectorData(current) ? current.sectors : lastGoodSnapshot.sectors,
    boards: current.boards.length ? current.boards : lastGoodSnapshot.boards,
    flow: hasFlowData(current) ? current.flow : lastGoodSnapshot.flow,
    global: hasGlobalData(current) ? current.global : lastGoodSnapshot.global,
    marketDate: current.marketDate ?? lastGoodSnapshot.marketDate,
  };

  if (hasIndexData(merged) || hasSectorData(merged) || hasGlobalData(merged) || hasFlowData(merged)) {
    lastGoodSnapshot = merged;
  }
  return merged;
}
