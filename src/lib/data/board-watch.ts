import { createServerFn } from "@tanstack/react-start";
import { fetchText, n, parseMaybeJsonp } from "./fetch-util";
import { SECTOR_RULES } from "./sectors";
import { isExchangeClosed, tradingDateLabel } from "./trading-day";

export type BoardCandidate = { code: string; name: string; type: "industry" | "concept"; icon: string };
export type BoardWatchQuote = { code: string; name: string; icon: string; pct: number | null; mainFlow: number | null; superFlow: number | null; largeFlow: number | null; midFlow: number | null; smallFlow: number | null; turnover: number | null; marketDate: string; source: string; validation: "live" | "unavailable" };

const UT = "fa5fd1943c7b386f172d6893dbfba10b";
const FIELDS = "f12,f14,f3,f62,f66,f72,f78,f84,f6";
const LIMIT = 1200;
const KNOWN = new Map(SECTOR_RULES.map((s) => [s.bkCode, s]));

function arr(value: unknown): Record<string, unknown>[] { if (Array.isArray(value)) return value as Record<string, unknown>[]; if (value && typeof value === "object") return Object.values(value) as Record<string, unknown>[]; return []; }
async function fetchBoards(): Promise<Record<string, unknown>[]> {
  try {
    const text = await fetchText(`https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${LIMIT}&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:2,m:90+t:3&fields=${encodeURIComponent(FIELDS)}&ut=${UT}&_=${Date.now()}`, 10_000, { Referer: "https://quote.eastmoney.com/" });
    const j = parseMaybeJsonp(text) as { data?: { diff?: unknown } };
    return arr(j?.data?.diff);
  } catch { return []; }
}
async function fetchBoardByCode(code: string): Promise<Record<string, unknown> | null> {
  try {
    const text = await fetchText(`https://push2.eastmoney.com/api/qt/stock/get?secid=90.${encodeURIComponent(code)}&fields=${encodeURIComponent(FIELDS)}&ut=${UT}&_=${Date.now()}`, 8_000, { Referer: "https://quote.eastmoney.com/" });
    const j = parseMaybeJsonp(text) as { data?: Record<string, unknown> | null };
    return j?.data && typeof j.data === "object" ? j.data : null;
  } catch { return null; }
}
function rowCode(row: Record<string, unknown>) { return String(row.f12 ?? "").trim(); }
function rowName(row: Record<string, unknown>) { return String(row.f14 ?? "").trim(); }
function iconFor(name: string) { const hit = SECTOR_RULES.find((s) => name.includes(s.name) || s.name.includes(name)); return hit?.id === "semi" ? "🔬" : hit?.id === "ai" ? "🤖" : hit?.id === "gold" ? "🥇" : hit?.id === "robot" ? "🦾" : "📈"; }
function typeFor(code: string): BoardCandidate["type"] { return KNOWN.has(code) ? KNOWN.get(code)!.prefer : "industry"; }
function score(name: string, q: string) {
  const n = name.toLowerCase(); const k = q.toLowerCase().trim();
  if (!k) return 0;
  if (n === k) return 100; if (n.startsWith(k)) return 90; if (n.includes(k)) return 70;
  const rule = SECTOR_RULES.find((s) => s.searchKeys.some((x) => x.toLowerCase() === k || x.toLowerCase().includes(k)));
  return rule && (name.includes(rule.name) || rule.searchKeys.some((x) => name.includes(x))) ? 60 : 0;
}

export const searchFundBoards = createServerFn({ method: "POST" }).validator((input: { query?: string }) => input).handler(async ({ data }): Promise<{ items: BoardCandidate[] }> => {
  const q = String(data.query ?? "").trim();
  if (!q) return { items: [] };
  const rows = await fetchBoards();
  const remote = rows.map((row): (BoardCandidate & { _score: number }) | null => {
    const code = rowCode(row); const name = rowName(row); const s = score(name, q);
    return code && name && s ? { code, name, icon: iconFor(name), type: typeFor(code), _score: s } : null;
  }).filter((x): x is BoardCandidate & { _score: number } => !!x).sort((a, b) => b._score - a._score);
  const local = SECTOR_RULES.map((rule): (BoardCandidate & { _score: number }) | null => {
    const hay = [rule.name, ...rule.searchKeys].map((x) => x.toLowerCase()); const k = q.toLowerCase();
    const s = hay.some((x) => x === k) ? 100 : hay.some((x) => x.startsWith(k)) ? 90 : hay.some((x) => x.includes(k)) ? 70 : 0;
    return s ? { code: rule.bkCode, name: rule.name, icon: iconFor(rule.name), type: rule.prefer, _score: s } : null;
  }).filter((x): x is BoardCandidate & { _score: number } => !!x);
  const merged = [...remote, ...local].sort((a, b) => b._score - a._score).filter((item, index, list) => list.findIndex((x) => x.code === item.code) === index).slice(0, 20).map(({ _score: _ignore, ...item }) => item);
  return { items: merged };
});

export const getBoardWatchQuotes = createServerFn({ method: "POST" }).validator((input: { codes?: string[] }) => input).handler(async ({ data }): Promise<{ rows: BoardWatchQuote[]; fetchedAt: number; weekend: boolean }> => {
  const codes = [...new Set((data.codes ?? []).map((x) => String(x).trim()).filter(Boolean))].slice(0, 30);
  const closed = isExchangeClosed();
  if (!codes.length) return { rows: [], fetchedAt: Date.now(), weekend: closed };
  const rows = await fetchBoards(); const byCode = new Map(rows.map((r) => [rowCode(r), r])); const date = tradingDateLabel();
  const result = await Promise.all(codes.map(async (code): Promise<BoardWatchQuote> => {
    const row = byCode.get(code) ?? await fetchBoardByCode(code);
    const pct = row ? n(row.f3) : null;
    if (!row) return { code, name: code, icon: "📈", pct: null, mainFlow: null, superFlow: null, largeFlow: null, midFlow: null, smallFlow: null, turnover: null, marketDate: date, source: "当前暂无可靠板块行情", validation: "unavailable" };
    return { code, name: rowName(row) || code, icon: iconFor(rowName(row) || code), pct, mainFlow: n(row.f62), superFlow: n(row.f66), largeFlow: n(row.f72), midFlow: n(row.f78), smallFlow: n(row.f84), turnover: n(row.f6), marketDate: date, source: "东方财富实时板块行情", validation: pct != null ? "live" : "unavailable" };
  }));
  return { rows: result, fetchedAt: Date.now(), weekend: closed };
});
