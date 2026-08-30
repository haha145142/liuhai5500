import { fetchText, n } from "./fetch-util";

export type QuotePoint = {
  code: string;
  price: number | null;
  pct: number | null;
  source: "tencent" | "eastmoney" | "sina";
  fetchedAt: number;
};

export type MultiSourceQuote = {
  code: string;
  price: number | null;
  pct: number | null;
  sources: QuotePoint[];
  usableSources: number;
  agreement: "three_source" | "two_source" | "single_source" | "disputed" | "unavailable";
  deviationPct: number | null;
};

function symbol(code: string): string | null {
  if (/^(6|68|58)\d{4,5}$/.test(code) || /^5\d{5}$/.test(code)) return `sh${code}`;
  if (/^(0|3|15|16)\d{4}$/.test(code)) return `sz${code}`;
  return null;
}

async function tencent(code: string): Promise<QuotePoint | null> {
  const s = symbol(code); if (!s) return null;
  try {
    const raw = await fetchText(`https://qt.gtimg.cn/q=${s}`, 5000);
    const m = raw.match(/v_(?:sh|sz)\d{6}="([^"]*)"/); if (!m) return null;
    const p = m[1].split("~");
    return { code, price: n(p[3]), pct: n(p[32]), source: "tencent", fetchedAt: Date.now() };
  } catch { return null; }
}

async function sina(code: string): Promise<QuotePoint | null> {
  const s = symbol(code); if (!s) return null;
  try {
    const raw = await fetchText(`https://hq.sinajs.cn/list=${s}`, 5000, { Referer: "https://finance.sina.com.cn/" });
    const m = raw.match(/="([^"]*)"/); if (!m) return null;
    const p = m[1].split(",");
    const price = n(p[3]); const prev = n(p[2]);
    const pct = price != null && prev ? ((price / prev) - 1) * 100 : null;
    return { code, price, pct, source: "sina", fetchedAt: Date.now() };
  } catch { return null; }
}

async function eastmoney(code: string): Promise<QuotePoint | null> {
  const s = symbol(code); if (!s) return null;
  const secid = s.startsWith("sh") ? `1.${code}` : `0.${code}`;
  try {
    const raw = await fetchText(`https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43,f169`, 5000, { Referer: "https://quote.eastmoney.com/" });
    const j = JSON.parse(raw) as any; const x = j?.data; if (!x) return null;
    return { code, price: n(x.f43) == null ? null : Number(x.f43) / 100, pct: n(x.f169) == null ? null : Number(x.f169) / 100, source: "eastmoney", fetchedAt: Date.now() };
  } catch { return null; }
}

export async function getMultiSourceQuote(code: string): Promise<MultiSourceQuote> {
  const results = (await Promise.all([tencent(code), eastmoney(code), sina(code)])).filter((x): x is QuotePoint => !!x && x.price != null && x.pct != null);
  if (!results.length) return { code, price: null, pct: null, sources: [], usableSources: 0, agreement: "unavailable", deviationPct: null };
  const pcts = results.map(x => x.pct as number);
  const max = Math.max(...pcts); const min = Math.min(...pcts);
  const deviationPct = max - min;
  let agreement: MultiSourceQuote["agreement"];
  if (results.length >= 3 && deviationPct <= 0.10) agreement = "three_source";
  else if (results.length >= 2 && deviationPct <= 0.20) agreement = "two_source";
  else if (results.length === 1) agreement = "single_source";
  else agreement = "disputed";
  const anchor = results[0];
  return { code, price: anchor.price, pct: anchor.pct, sources: results, usableSources: results.length, agreement, deviationPct };
}
