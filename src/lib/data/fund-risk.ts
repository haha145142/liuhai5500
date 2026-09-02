import { createServerFn } from "@tanstack/react-start";
import { fetchText, n, parseMaybeJsonp } from "./fetch-util";

type FundRiskMetric = {
  code: string;
  maxDrawdown1Y: number | null;
  historyDate: string | null;
  source: string;
};

type Cached = { savedAt: number; value: FundRiskMetric };
const CACHE_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, Cached>();

function extractRows(value: unknown): Record<string, unknown>[] {
  const data = value as { Data?: { LSJZList?: unknown[] } } | null;
  return Array.isArray(data?.Data?.LSJZList)
    ? data.Data.LSJZList.filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    : [];
}

function chinaDateKey(now = new Date()) {
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

function addDays(dateKey: string, days: number) {
  const value = new Date(`${dateKey}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

function calcMaxDrawdown(rows: Record<string, unknown>[], cutoffDate: string) {
  const navs = rows
    .map((row) => ({ date: String(row.FSRQ ?? "").trim(), nav: n(row.DWJZ) }))
    .filter((x): x is { date: string; nav: number } => !!x.date && x.date >= cutoffDate && x.nav != null && x.nav > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (navs.length < 2) return { drawdown: null, date: navs.at(-1)?.date ?? null };
  let peak = navs[0].nav;
  let maxDrawdown = 0;
  for (const item of navs) {
    peak = Math.max(peak, item.nav);
    if (peak > 0) maxDrawdown = Math.min(maxDrawdown, item.nav / peak - 1);
  }
  return { drawdown: Number.isFinite(maxDrawdown) ? maxDrawdown * 100 : null, date: navs.at(-1)?.date ?? null };
}

async function loadOne(code: string): Promise<FundRiskMetric> {
  const cachedValue = cache.get(code);
  if (cachedValue && Date.now() - cachedValue.savedAt < CACHE_MS) return cachedValue.value;
  try {
    const today = chinaDateKey();
    const cutoffDate = addDays(today, -365);
    const url = `https://api.fund.eastmoney.com/f10/lsjz?fundCode=${encodeURIComponent(code)}&pageIndex=1&pageSize=400&startDate=${cutoffDate}&endDate=${today}&_=${Date.now()}`;
    const raw = await fetchText(url, 7000, { Referer: `https://fundf10.eastmoney.com/jjjz_${code}.html` });
    const rows = extractRows(parseMaybeJsonp(raw));
    const metric = calcMaxDrawdown(rows, cutoffDate);
    const value: FundRiskMetric = { code, maxDrawdown1Y: metric.drawdown, historyDate: metric.date, source: rows.length ? "东方财富近一年历史净值" : "暂无可靠近一年历史净值" };
    if (rows.length) cache.set(code, { savedAt: Date.now(), value });
    return value;
  } catch {
    return { code, maxDrawdown1Y: cachedValue?.value.maxDrawdown1Y ?? null, historyDate: cachedValue?.value.historyDate ?? null, source: cachedValue?.value.source ?? "暂无可靠近一年历史净值" };
  }
}

export const getFundRiskMetrics = createServerFn({ method: "POST" })
  .validator((input: { codes: string[] }) => ({ codes: Array.isArray(input?.codes) ? input.codes.map((code) => String(code).trim()).filter((code) => /^\d{6}$/.test(code)).slice(0, 40) : [] }))
  .handler(async ({ data }): Promise<FundRiskMetric[]> => {
    const queue = [...data.codes];
    const results: FundRiskMetric[] = [];
    const worker = async () => {
      while (queue.length) {
        const code = queue.shift();
        if (!code) break;
        results.push(await loadOne(code));
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, queue.length || 1) }, () => worker()));
    return data.codes.map((code) => results.find((item) => item.code === code) ?? { code, maxDrawdown1Y: null, historyDate: null, source: "暂无可靠近一年历史净值" });
  });

export type { FundRiskMetric };
