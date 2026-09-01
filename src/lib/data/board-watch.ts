import { createServerFn } from "@tanstack/react-start";
import { fetchText, n, parseMaybeJsonp } from "./fetch-util";
import { isExchangeClosed, tradingDateLabel } from "./trading-day";

export type BoardCandidate = { code: string; name: string; type: "industry" | "concept"; icon: string };
export type BoardWatchQuote = {
  code: string;
  name: string;
  icon: string;
  pct: number | null;
  mainFlow: number | null;
  superFlow: number | null;
  largeFlow: number | null;
  midFlow: number | null;
  smallFlow: number | null;
  turnover: number | null;
  marketDate: string;
  source: string;
  validation: "live" | "unavailable";
};

const UT = "fa5fd1943c7b386f172d6893dbfba10b";
const FIELDS = "f12,f14,f3,f62,f66,f69,f72,f75,f6";
const LIMIT = 1200;

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

function candidateName(row: Record<string, unknown>) {
  return String(row.f14 ?? "").trim();
}

function candidateCode(row: Record<string, unknown>) {
  return String(row.f12 ?? "").trim();
}

function matchScore(name: string, query: string) {
  const n = name.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  if (n === q) return 100;
  if (n.startsWith(q)) return 80;
  if (n.includes(q)) return 60;
  return 0;
}

export const searchFundBoards = createServerFn({ method: "POST" })
  .validator((input: { query?: string }) => input)
  .handler(async ({ data }): Promise<{ items: BoardCandidate[] }> => {
    const q = String(data.query ?? "").trim();
    if (!q) return { items: [] };
    const rows = await fetchBoards();
    const items = rows
      .map((row): BoardCandidate | null => {
        const code = candidateCode(row);
        const name = candidateName(row);
        if (!code || !name) return null;
        const score = matchScore(name, q);
        if (!score) return null;
        return { code, name, type: code.startsWith("BK") ? "industry" : "concept", icon: "📈" };
      })
      .filter((x): x is BoardCandidate => !!x)
      .slice(0, 20);

    const dedup = new Map<string, BoardCandidate>();
    for (const item of items) dedup.set(item.code, item);
    return { items: [...dedup.values()] };
  });

export const getBoardWatchQuotes = createServerFn({ method: "POST" })
  .validator((input: { codes?: string[] }) => input)
  .handler(async ({ data }): Promise<{ rows: BoardWatchQuote[]; fetchedAt: number; weekend: boolean }> => {
    const codes = [...new Set((data.codes ?? []).map((x) => String(x).trim()).filter(Boolean))].slice(0, 30);
    if (!codes.length) return { rows: [], fetchedAt: Date.now(), weekend: isExchangeClosed() };

    const rows = await fetchBoards();
    const byCode = new Map(rows.map((row) => [candidateCode(row), row]));
    const date = tradingDateLabel();
    const result = codes.map((code): BoardWatchQuote => {
      const row = byCode.get(code);
      if (!row) {
        return { code, name: code, icon: "📈", pct: null, mainFlow: null, superFlow: null, largeFlow: null, midFlow: null, smallFlow: null, turnover: null, marketDate: date, source: "当前暂无可靠板块行情", validation: "unavailable" };
      }
      return {
        code,
        name: candidateName(row) || code,
        icon: "📈",
        pct: n(row.f3),
        mainFlow: n(row.f62),
        superFlow: n(row.f66),
        largeFlow: n(row.f69),
        midFlow: n(row.f72),
        smallFlow: n(row.f75),
        turnover: n(row.f6),
        marketDate: date,
        source: "东方财富实时板块行情",
        validation: n(row.f3) != null ? "live" : "unavailable",
      };
    });

    return { rows: result, fetchedAt: Date.now(), weekend: isExchangeClosed() };
  });
