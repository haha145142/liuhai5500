import { createServerFn } from "@tanstack/react-start";
import { isExchangeClosed, tradingDateLabel } from "./trading-day.ts";

type RawRow = {
  name?: unknown;
  sector_type?: unknown;
  provider?: unknown;
  change_pct?: unknown;
  main_net_inflow?: unknown;
  main_net_ratio?: unknown;
  super_net_inflow?: unknown;
  large_net_inflow?: unknown;
  mid_net_inflow?: unknown;
  small_net_inflow?: unknown;
};

type Snapshot = {
  ok?: boolean;
  source?: string;
  provider?: string;
  schemaVersion?: number;
  fetchedAt?: string | null;
  marketDate?: string | null;
  complete?: boolean;
  rowCount?: number;
  rows?: RawRow[];
  errors?: { sector_type?: string; provider?: string; error?: string }[];
  sources?: { sector_type?: string; provider?: string }[];
};

export type AkShareSectorFlow = {
  name: string;
  sectorType: "industry" | "concept" | "region";
  provider: string | null;
  changePct: number | null;
  mainNetInflow: number | null;
  mainNetRatio: number | null;
  superNetInflow: number | null;
  largeNetInflow: number | null;
  midNetInflow: number | null;
  smallNetInflow: number | null;
};

export type AkShareSnapshotFreshness = "live" | "recent" | "stale";

export type AkShareSectorFlowResult = {
  ok: boolean;
  source: "AKShare" | "none";
  marketDate: string | null;
  fetchedAt: string | null;
  complete: boolean;
  freshness: AkShareSnapshotFreshness;
  rows: AkShareSectorFlow[];
  sources: { sectorType: string; provider: string }[];
  errors: { sectorType: string | null; provider: string | null; error: string }[];
  error?: string;
};

const SNAPSHOT_URL =
  "https://raw.githubusercontent.com/haha145142/liuhai5500/data/akshare/data/akshare/sector-flow.json";

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(String(value).replaceAll(",", "").replace("%", ""));
  return Number.isFinite(n) ? n : null;
}

function normalizeRow(row: RawRow): AkShareSectorFlow | null {
  const name = String(row.name ?? "").trim();
  const sectorType = row.sector_type;
  if (!name || (sectorType !== "industry" && sectorType !== "concept" && sectorType !== "region")) return null;
  return {
    name,
    sectorType,
    provider: row.provider == null ? null : String(row.provider).trim() || null,
    changePct: asNumber(row.change_pct),
    mainNetInflow: asNumber(row.main_net_inflow),
    mainNetRatio: asNumber(row.main_net_ratio),
    superNetInflow: asNumber(row.super_net_inflow),
    largeNetInflow: asNumber(row.large_net_inflow),
    midNetInflow: asNumber(row.mid_net_inflow),
    smallNetInflow: asNumber(row.small_net_inflow),
  };
}

function snapshotFreshness(marketDate: string | null, fetchedAt: string | null, now = new Date()): AkShareSnapshotFreshness {
  if (!marketDate || marketDate !== tradingDateLabel(now) || !fetchedAt) return "stale";
  const parsed = Date.parse(fetchedAt);
  if (!Number.isFinite(parsed)) return "stale";
  const ageMs = Math.max(0, now.getTime() - parsed);
  const twelveHours = 12 * 60 * 60 * 1000;
  const thirtyMinutes = 30 * 60 * 1000;
  if (!isExchangeClosed(now) && ageMs <= thirtyMinutes) return "live";
  if (ageMs <= twelveHours) return "recent";
  // On closed days, retain the latest trading-day snapshot rather than inventing empty data.
  return isExchangeClosed(now) ? "recent" : "stale";
}

export function classifyAkShareSnapshotFreshness(
  marketDate: string | null,
  fetchedAt: string | null,
  now = new Date(),
): AkShareSnapshotFreshness {
  return snapshotFreshness(marketDate, fetchedAt, now);
}

export async function fetchAkShareSnapshot(): Promise<AkShareSectorFlowResult> {
  const empty = (error: string, marketDate: string | null = null, fetchedAt: string | null = null): AkShareSectorFlowResult => ({
    ok: false,
    source: "none",
    marketDate,
    fetchedAt,
    complete: false,
    freshness: "stale",
    rows: [],
    sources: [],
    errors: [],
    error,
  });

  try {
    const response = await fetch(`${SNAPSHOT_URL}?t=${Date.now()}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return empty(`HTTP ${response.status}`);
    const snapshot = (await response.json()) as Snapshot;
    const rows = (snapshot.rows ?? []).map(normalizeRow).filter((row): row is AkShareSectorFlow => row !== null);
    const marketDate = snapshot.marketDate ?? null;
    const fetchedAt = snapshot.fetchedAt ?? null;
    const freshness = snapshotFreshness(marketDate, fetchedAt);
    const sources = (snapshot.sources ?? []).flatMap((source) => {
      const sectorType = String(source.sector_type ?? "").trim();
      const provider = String(source.provider ?? "").trim();
      return sectorType && provider ? [{ sectorType, provider }] : [];
    });
    const errors = (snapshot.errors ?? []).flatMap((item) => {
      const error = String(item.error ?? "").trim();
      return error
        ? [{ sectorType: item.sector_type ? String(item.sector_type) : null, provider: item.provider ? String(item.provider) : null, error }]
        : [];
    });
    if (!rows.length) return empty("AKShare 快照暂无可靠板块资金流", marketDate, fetchedAt);
    if (freshness === "stale") {
      return { ok: false, source: "none", marketDate, fetchedAt, complete: snapshot.complete === true, freshness, rows: [], sources, errors, error: "AKShare 板块资金流已过期" };
    }
    return {
      ok: snapshot.ok === true,
      source: "AKShare",
      marketDate,
      fetchedAt,
      complete: snapshot.complete !== false,
      freshness,
      rows,
      sources,
      errors,
    };
  } catch (error) {
    return empty(error instanceof Error ? error.message : "AKShare 快照读取失败");
  }
}

export const getAkShareSectorFlow = createServerFn({ method: "GET" }).handler(fetchAkShareSnapshot);

function scoreFlow(row: AkShareSectorFlow): number | null {
  const main = row.mainNetInflow;
  const superLarge = [row.superNetInflow, row.largeNetInflow].every((x) => x != null)
    ? (row.superNetInflow ?? 0) + (row.largeNetInflow ?? 0)
    : null;
  if (main == null && superLarge == null) return null;
  const primary = main ?? superLarge ?? 0;
  const secondary = superLarge ?? main ?? 0;
  const ratio = Math.max(-1, Math.min(1, primary === 0 ? 0 : secondary / Math.abs(primary)));
  return primary * (0.8 + ratio * 0.2);
}

export function rankAkShareSectorFlow(rows: AkShareSectorFlow[], limit = 10) {
  return [...rows]
    .map((row) => ({ row, score: scoreFlow(row) }))
    .filter((item): item is { row: AkShareSectorFlow; score: number } => item.score != null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
