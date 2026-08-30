import { fetchText, n } from "./fetch-util";

export type QuotePoint = {
  code: string;
  price: number | null;
  pct: number | null;
  source: "tencent" | "eastmoney" | "sina";
  fetchedAt: number;
  latencyMs: number;
  freshness: "fresh" | "stale" | "unknown";
  complete: boolean;
};

export type SourceHealth = {
  source: QuotePoint["source"];
  healthy: boolean;
  score: number;
  latencyMs: number;
  complete: boolean;
  freshness: QuotePoint["freshness"];
  reason: string;
};

export type MultiSourceQuote = {
  code: string;
  price: number | null;
  pct: number | null;
  sources: QuotePoint[];
  health: SourceHealth[];
  usableSources: number;
  agreement: "three_source" | "two_source" | "single_source" | "disputed" | "unavailable";
  deviationPct: number | null;
  validation: "cross_checked" | "single_source" | "disputed" | "unavailable";
};

function symbol(code: string): string | null {
  if (/^(6|68|58)\d{4,5}$/.test(code) || /^5\d{5}$/.test(code)) return `sh${code}`;
  if (/^(0|3|15|16)\d{4}$/.test(code)) return `sz${code}`;
  return null;
}

function freshnessFromPct(pct: number | null, fetchedAt: number): QuotePoint["freshness"] {
  if (pct == null) return "unknown";
  const age = Date.now() - fetchedAt;
  return age <= 15_000 ? "fresh" : age <= 60_000 ? "stale" : "unknown";
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; latencyMs: number }> {
  const started = Date.now();
  try { return { value: await fn(), latencyMs: Date.now() - started }; }
  catch { return { value: await Promise.resolve(null as T), latencyMs: Date.now() - started }; }
}

async function tencent(code: string): Promise<QuotePoint | null> {
  const s = symbol(code); if (!s) return null;
  const r = await timed(async () => {
    const raw = await fetchText(`https://qt.gtimg.cn/q=${s}`, 5000);
    const m = raw.match(/v_(?:sh|sz)\d{6}=\"([^\"]*)\"/); if (!m) return null;
    const p = m[1].split("~"); return { price: n(p[3]), pct: n(p[32]) };
  });
  if (!r.value) return null;
  const fetchedAt = Date.now();
  return { code, ...r.value, source: "tencent", fetchedAt, latencyMs: r.latencyMs, freshness: freshnessFromPct(r.value.pct, fetchedAt), complete: r.value.price != null && r.value.pct != null };
}

async function sina(code: string): Promise<QuotePoint | null> {
  const s = symbol(code); if (!s) return null;
  const r = await timed(async () => {
    const raw = await fetchText(`https://hq.sinajs.cn/list=${s}`, 5000, { Referer: "https://finance.sina.com.cn/" });
    const m = raw.match(/=\"([^\"]*)\"/); if (!m) return null;
    const p = m[1].split(","); const price = n(p[3]); const prev = n(p[2]);
    return { price, pct: price != null && prev ? ((price / prev) - 1) * 100 : null };
  });
  if (!r.value) return null;
  const fetchedAt = Date.now();
  return { code, ...r.value, source: "sina", fetchedAt, latencyMs: r.latencyMs, freshness: freshnessFromPct(r.value.pct, fetchedAt), complete: r.value.price != null && r.value.pct != null };
}

async function eastmoney(code: string): Promise<QuotePoint | null> {
  const s = symbol(code); if (!s) return null;
  const secid = s.startsWith("sh") ? `1.${code}` : `0.${code}`;
  const r = await timed(async () => {
    const raw = await fetchText(`https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43,f169`, 5000, { Referer: "https://quote.eastmoney.com/" });
    const j = JSON.parse(raw) as any; const x = j?.data; if (!x) return null;
    return { price: n(x.f43) == null ? null : Number(x.f43) / 100, pct: n(x.f169) == null ? null : Number(x.f169) / 100 };
  });
  if (!r.value) return null;
  const fetchedAt = Date.now();
  return { code, ...r.value, source: "eastmoney", fetchedAt, latencyMs: r.latencyMs, freshness: freshnessFromPct(r.value.pct, fetchedAt), complete: r.value.price != null && r.value.pct != null };
}

function healthOf(q: QuotePoint): SourceHealth {
  let score = 100;
  if (!q.complete) score -= 45;
  if (q.freshness === "stale") score -= 15;
  if (q.freshness === "unknown") score -= 35;
  if (q.latencyMs > 1500) score -= 10;
  if (q.latencyMs > 3500) score -= 15;
  score = Math.max(0, score);
  return { source: q.source, healthy: q.complete && q.freshness !== "unknown" && score >= 60, score, latencyMs: q.latencyMs, complete: q.complete, freshness: q.freshness, reason: q.complete ? (q.freshness === "fresh" ? "字段完整、响应及时" : "数据可用但时效偏弱") : "价格或涨跌字段不完整" };
}

export async function getMultiSourceQuote(code: string): Promise<MultiSourceQuote> {
  const results = (await Promise.all([tencent(code), eastmoney(code), sina(code)])).filter((x): x is QuotePoint => !!x && x.price != null && x.pct != null);
  if (!results.length) return { code, price: null, pct: null, sources: [], health: [], usableSources: 0, agreement: "unavailable", deviationPct: null, validation: "unavailable" };

  const healthy = results.filter((x) => healthOf(x).healthy);
  const pool = healthy.length ? healthy : results;
  const pcts = pool.map(x => x.pct as number);
  const max = Math.max(...pcts); const min = Math.min(...pcts); const deviationPct = max - min;
  let agreement: MultiSourceQuote["agreement"];
  if (healthy.length >= 3 && deviationPct <= 0.10) agreement = "three_source";
  else if (healthy.length >= 2 && deviationPct <= 0.20) agreement = "two_source";
  else if (pool.length === 1) agreement = "single_source";
  else agreement = "disputed";

  const anchor = pool.slice().sort((a, b) => a.latencyMs - b.latencyMs)[0];
  const validation = agreement === "three_source" || agreement === "two_source" ? "cross_checked" : agreement === "single_source" ? "single_source" : agreement === "disputed" ? "disputed" : "unavailable";
  return { code, price: anchor.price, pct: anchor.pct, sources: results, health: results.map(healthOf), usableSources: healthy.length, agreement, deviationPct, validation };
}
