import { createServerFn } from "@tanstack/react-start";
import { fetchText, n, parseMaybeJsonp } from "./fetch-util";
import { validateMoneyFlow } from "../calc/money-flow-validation";
import { latestTradingDate } from "./trading-day";
import type { MarketOrder } from "../types";

export type MarketMoneyFlow = MarketOrder & { marketDate: string; fetchedAt: number; turnover: number | null; previousTurnover: number | null; turnoverChangePct: number | null; turnoverState: "放量" | "缩量" | "持平" | "暂无可靠数据"; source: string; sourceCount: number; confidence: "high" | "medium" | "low"; freshness: "live" | "recent" | "stale" };

const EM_UT = "fa5fd1943c7b386f172d6893dbfba10b";
const FLOW_URL = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=6000&po=1&np=1&fltt=2&invt=2&fid=f62&fs=${encodeURIComponent("m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23")}&fields=f62,f66,f69,f72,f75,f6&ut=${EM_UT}`;
const SNAPSHOT_URL = "https://raw.githubusercontent.com/haha145142/liuhai5500/data/akshare/sector-flow.json";
const mem = new Map<string, { at: number; value: MarketMoneyFlow }>();
const TTL = 90_000;

function finite(v: unknown) { const x = n(v); return x != null && Number.isFinite(x) ? x : null; }
function safe(v: number | null) { return v != null && Math.abs(v) <= 1e14 ? v : null; }
function dateLabel(date: Date) { return date.toISOString().slice(0, 10); }
function chinaMinuteOfDay(date: Date) { const text = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date); const [hour, minute] = text.split(":").map(Number); return hour * 60 + minute; }
function freshnessFor(now: Date, marketDate: string, fetchedAt: number) { const latest = dateLabel(latestTradingDate(now)); if (marketDate !== latest) return "stale" as const; const age = Math.max(0, now.getTime() - fetchedAt); const minute = chinaMinuteOfDay(now); if (age <= 5 * 60_000 && minute >= 570 && minute <= 900) return "live" as const; if (age <= 30 * 60_000) return "recent" as const; return "stale" as const; }
function validate(flow: MarketOrder) { const checked = validateMoneyFlow(flow); return { ...flow, validation: checked.validation, internalDelta: checked.internalDelta, balanceDelta: checked.balanceDelta, note: checked.reason }; }
function summarize(rows: Record<string, unknown>[]) { const keys = ["f62", "f66", "f69", "f72", "f75"] as const; const sums = Object.fromEntries(keys.map((key) => [key, rows.reduce((sum, row) => sum + (finite(row[key]) ?? 0), 0)])) as Record<string, number>; return validate({ main: safe(sums.f62) ?? 0, super: safe(sums.f66) ?? 0, large: safe(sums.f69) ?? 0, mid: safe(sums.f72) ?? 0, small: safe(sums.f75) ?? 0, count: rows.length, validation: "unreliable", internalDelta: 0, balanceDelta: 0, note: "" }); }
async function fetchLiveRows() { const text = await fetchText(`${FLOW_URL}&_=${Date.now()}`, 4500, { Referer: "https://data.eastmoney.com/zjlx/" }); const json = parseMaybeJsonp(text) as { data?: { diff?: unknown } }; const diff = json?.data?.diff; const rows = Array.isArray(diff) ? diff as Record<string, unknown>[] : diff && typeof diff === "object" ? Object.values(diff) as Record<string, unknown>[] : []; if (!rows.length) throw new Error("empty-money-flow"); return rows; }
async function fetchSnapshot() { const text = await fetchText(`${SNAPSHOT_URL}?_=${Date.now()}`, 2500, { Accept: "application/json" }); const json = JSON.parse(text) as { ok?: boolean; provider?: string; fetchedAt?: string; marketDate?: string; rows?: unknown[] }; if (!json.ok || !Array.isArray(json.rows) || !json.rows.length || !json.marketDate) throw new Error("invalid-money-flow-snapshot"); const rows = json.rows.filter((x): x is Record<string, unknown> => !!x && typeof x === "object"); const main = rows.reduce((s, r) => s + (finite(r.main_net_inflow) ?? 0), 0); return { marketDate: json.marketDate, fetchedAt: Date.parse(String(json.fetchedAt ?? "")) || Date.now(), rows, main, provider: String(json.provider ?? "AKShare") }; }
async function fetchTurnoverKline(secid: string) { const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58&klt=101&fqt=1&beg=-5&end=20500101&_=${Date.now()}`; const text = await fetchText(url, 4000, { Referer: "https://quote.eastmoney.com/" }); const json = parseMaybeJsonp(text) as { data?: { klines?: unknown[] } }; const rows = Array.isArray(json?.data?.klines) ? json.data!.klines.map((x) => String(x).split(",")) : []; return rows.map((parts) => ({ date: parts[0] || "", amount: finite(parts[5]) })).filter((x): x is { date: string; amount: number } => !!x.date && x.amount != null); }
function withTurnover(base: ReturnType<typeof summarize>, marketDate: string, fetchedAt: number, source: string, confidence: "high" | "medium" | "low") { return { ...base, marketDate, fetchedAt, turnover: null, previousTurnover: null, turnoverChangePct: null, turnoverState: "暂无可靠数据" as const, source, sourceCount: 1, confidence, freshness: freshnessFor(new Date(), marketDate, fetchedAt) }; }

export const getMarketMoneyFlow = createServerFn({ method: "GET" }).handler(async (): Promise<MarketMoneyFlow | null> => {
  const now = new Date();
  const key = dateLabel(latestTradingDate(now));
  const hit = mem.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  // Fast path: use the already-published market snapshot. This prevents a page load from
  // blocking on the heavyweight 6000-row live request. The live feed is only a fallback.
  try {
    const snapshot = await fetchSnapshot();
    const rows = snapshot.rows;
    const base = summarize(rows);
    if (base.count >= 20 && base.validation !== "unreliable") {
      const result = withTurnover(base, snapshot.marketDate, snapshot.fetchedAt, `${snapshot.provider} 全市场资金快照（后台采集）`, "medium");
      mem.set(key, { at: Date.now(), value: result });
      return result;
    }
  } catch { /* fall through to live provider */ }

  try {
    const base = summarize(await fetchLiveRows());
    if (base.count < 1000 || base.validation === "unreliable") return null;
    const [sh, sz] = await Promise.all([fetchTurnoverKline("1.000001").catch(() => []), fetchTurnoverKline("0.399001").catch(() => [])]);
    const merged = new Map<string, number>(); for (const row of [...sh, ...sz]) merged.set(row.date, (merged.get(row.date) ?? 0) + row.amount);
    const dates = [...merged.keys()].sort(); const turnover = dates.length ? merged.get(dates.at(-1)!) ?? null : null; const previousTurnover = dates.length > 1 ? merged.get(dates.at(-2)!) ?? null : null;
    const turnoverChangePct = turnover != null && previousTurnover != null && previousTurnover > 0 ? (turnover / previousTurnover - 1) * 100 : null;
    const turnoverState: MarketMoneyFlow["turnoverState"] = turnoverChangePct == null ? "暂无可靠数据" : turnoverChangePct > 5 ? "放量" : turnoverChangePct < -5 ? "缩量" : "持平";
    const fetchedAt = Date.now(); const result: MarketMoneyFlow = { ...base, marketDate: key, fetchedAt, turnover, previousTurnover, turnoverChangePct, turnoverState, source: "东方财富全A资金流 + 沪深成交额日线（单供应商；仅做内部一致性校验，不宣称双源）", sourceCount: 1, confidence: "low", freshness: freshnessFor(now, key, fetchedAt) };
    mem.set(key, { at: fetchedAt, value: result }); return result;
  } catch { return null; }
});
