import { createServerFn } from "@tanstack/react-start";

type RawRow = {
  name?: unknown;
  sector_type?: unknown;
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
  errors?: { sector_type?: string; error?: string }[];
};

export type AkShareSectorFlow = {
  name: string;
  sectorType: "industry" | "concept" | "region";
  changePct: number | null;
  mainNetInflow: number | null;
  mainNetRatio: number | null;
  superNetInflow: number | null;
  largeNetInflow: number | null;
  midNetInflow: number | null;
  smallNetInflow: number | null;
};

export type AkShareSectorFlowResult = {
  ok: boolean;
  source: "AKShare" | "none";
  marketDate: string | null;
  fetchedAt: string | null;
  complete: boolean;
  rows: AkShareSectorFlow[];
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
    changePct: asNumber(row.change_pct),
    mainNetInflow: asNumber(row.main_net_inflow),
    mainNetRatio: asNumber(row.main_net_ratio),
    superNetInflow: asNumber(row.super_net_inflow),
    largeNetInflow: asNumber(row.large_net_inflow),
    midNetInflow: asNumber(row.mid_net_inflow),
    smallNetInflow: asNumber(row.small_net_inflow),
  };
}

async function fetchSnapshot(): Promise<AkShareSectorFlowResult> {
  try {
    const response = await fetch(`${SNAPSHOT_URL}?t=${Date.now()}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, source: "none", marketDate: null, fetchedAt: null, complete: false, rows: [], error: `HTTP ${response.status}` };
    const snapshot = (await response.json()) as Snapshot;
    const rows = (snapshot.rows ?? []).map(normalizeRow).filter((row): row is AkShareSectorFlow => row !== null);
    if (!rows.length) return { ok: false, source: "none", marketDate: snapshot.marketDate ?? null, fetchedAt: snapshot.fetchedAt ?? null, complete: false, rows: [], error: "AKShare 快照暂无可靠板块资金流" };
    return {
      ok: snapshot.ok === true,
      source: "AKShare",
      marketDate: snapshot.marketDate ?? null,
      fetchedAt: snapshot.fetchedAt ?? null,
      complete: snapshot.complete !== false,
      rows,
    };
  } catch (error) {
    return { ok: false, source: "none", marketDate: null, fetchedAt: null, complete: false, rows: [], error: error instanceof Error ? error.message : "AKShare 快照读取失败" };
  }
}

export const getAkShareSectorFlow = createServerFn({ method: "GET" }).handler(fetchSnapshot);

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
