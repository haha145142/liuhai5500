import { createServerFn } from "@tanstack/react-start";
import { fetchText, n, parseMaybeJsonp } from "./fetch-util";
import { SECTOR_RULES } from "./sectors";
import { isExchangeClosed, tradingDateLabel } from "./trading-day";

export type BoardCandidate = { code: string; name: string; type: "industry" | "concept"; icon: string };
export type BoardWatchQuote = {
  code: string; name: string; icon: string; pct: number | null; mainFlow: number | null;
  superFlow: number | null; largeFlow: number | null; midFlow: number | null; smallFlow: number | null;
  turnover: number | null; marketDate: string; source: string; validation: "live" | "unavailable";
};

const UT = "fa5fd1943c7b386f172d6893dbfba10b";
// Eastmoney clist money fields: f62 main, f66 super-large, f72 large, f78 medium, f84 small.
const FIELDS = "f12,f14,f3,f62,f66,f72,f78,f84,f6";
const LIMIT = 1200;
const KNOWN = new Map(SECTOR_RULES.map((s) => [s.bkCode, s]));

function arr(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (value && typeof value === "object") return Object.values(value) as Record<string, unknown>[];
  return [];
}

async function fetchBoards(): Promise<Record<string, unknown>[]> {
  try {
    const text = await fetchText(
      `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${LIMIT}&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:2,m:90+t:3&fields=${encodeURIComponent(FIELDS)}&ut=${UT}&_=${Date.now()}`,
      10_000,
      { Referer: "https://quote.eastmoney.com/" },
    );
    const j = parseMaybeJsonp(text) as { data?: { diff?: unknown } };
    return arr(j?.data?.diff);
  } catch {
    return [];
  }
}

function rowCode(row: Record<string, unknown>) { return String(row.f12 ?? "").trim(); }
function rowName(row: Record<string, unknown>) { return String(row.f14 ?? "").trim(); }
function iconFor(name: string) {
  const hit = SECTOR_RULES.find((s) => name.includes(s.name) || s.name.includes(name));
  return hit?.id === "semi" ? "🔬" : hit?.id === "ai" ? "🤖" : hit?.id === "gold" ? "🥇" : hit?.id === "robot" ? "🦾" : "📈";
}
function typeFor(code: string): BoardCandidate["type"] { return KNOWN.has(code) ? KNOWN.get(code)!.prefer : "industry"; }
function score(name: string, q: string) {
  const lowerName = name.toLowerCase(); const lowerQuery = q.toLowerCase().trim();
  if (!lowerQuery) return 0; if (lowerName === lowerQuery) return 100; if (lowerName.startsWith(lowerQuery)) return 90; if (lowerName.includes(lowerQuery)) return 70;
  const rule = SECTOR_RULES.find((s) => s.searchKeys.some((k) => k.toLowerCase() === lowerQuery || k.toLowerCase().includes(lowerQuery)));
  return rule && (name.includes(rule.name) || rule.searchKeys.some((k) => name.includes(k))) ? 60 : 0;
}

export const searchFundBoards = createServerFn({ method: "POST" }).validator((input: { query?: string }) => input).handler(async ({ data }): Promise<{ items: BoardCandidate[] }> => {
  const q = String(data.query ?? "").trim();
  if (!q) return { items: [] };
  const rows = await fetchBoards();
  const out = rows.map((row): (BoardCandidate & { _score: number }) | null => {
    const code = rowCode(row); const name = rowName(row); const s = score(name, q);
    return code && name && s ? { code, name, icon: iconFor(name), type: typeFor(code), _score: s } : null;
  }).filter((x): x is BoardCandidate & { _score: number } => !!x).sort((a, b) => b._score - a._score).slice(0, 20)
    .map(({ _score: _ignore, ...item }) => item);
  return { items: out };
});

export const getBoardWatchQuotes = createServerFn({ method: "POST" }).validator((input: { codes?: string[] }) => input).handler(async ({ data }): Promise<{ rows: BoardWatchQuote[]; fetchedAt: number; weekend: boolean }> => {
  const codes = [...new Set((data.codes ?? []).map((x) => String(x).trim()).filter(Boolean))].slice(0, 30);
  const closed = isExchangeClosed();
  if (!codes.length) return { rows: [], fetchedAt: Date.now(), weekend: closed };
  const rows = await fetchBoards(); const byCode = new Map(rows.map((r) => [rowCode(r), r])); const date = tradingDateLabel();
  const result = codes.map((code): BoardWatchQuote => {
    const row = byCode.get(code); const pct = row ? n(row.f3) : null;
    if (!row) return { code, name: code, icon: "📈", pct: null, mainFlow: null, superFlow: null, largeFlow: null, midFlow: null, smallFlow: null, turnover: null, marketDate: date, source: "当前暂无可靠板块行情", validation: "unavailable" };
    return {
      code,
      name: rowName(row) || code,
      icon: iconFor(rowName(row)),
      pct,
      mainFlow: n(row.f62),
      superFlow: n(row.f66),
      largeFlow: n(row.f72),
      midFlow: n(row.f78),
      smallFlow: n(row.f84),
      turnover: n(row.f6),
      marketDate: date,
      source: "东方财富实时板块行情",
      validation: pct != null ? "live" : "unavailable",
    };
  });
  return { rows: result, fetchedAt: Date.now(), weekend: closed };
});
