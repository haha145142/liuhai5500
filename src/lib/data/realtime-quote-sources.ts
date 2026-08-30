import { fetchText, n } from "./fetch-util";
import type { QuoteSample } from "./market-quote-validation";

export type RealtimeQuote = QuoteSample & { available: boolean };

function symbol(code: string) {
  if (/^(6|68|58)\d{4,5}$/.test(code) || /^5\d{5}$/.test(code)) return `sh${code}`;
  if (/^(0|3|15|16)\d{4}$/.test(code)) return `sz${code}`;
  return null;
}

/** Tencent quote adapter. It is intentionally a source adapter only: callers
 * decide whether to trust it and whether to cross-check another source. */
export async function fetchTencentQuote(code: string): Promise<RealtimeQuote> {
  const s = symbol(code);
  if (!s) return { code, price: null, pct: null, source: "腾讯财经", available: false };
  try {
    const text = await fetchText(`https://qt.gtimg.cn/q=${s}`, 7000);
    const m = text.match(/=\"([^\"]*)\"/);
    const p = m ? m[1].split("~") : [];
    const price = n(p[3]);
    const pct = n(p[32]);
    return { code, price, pct, source: "腾讯财经", available: price != null || pct != null };
  } catch {
    return { code, price: null, pct: null, source: "腾讯财经", available: false };
  }
}

/** Eastmoney push quote adapter for one security. Kept separate from the
 * fund valuation formula so source changes cannot silently alter the model. */
export async function fetchEastmoneyQuote(code: string): Promise<RealtimeQuote> {
  const secid = /^(6|68|58)\d{4,5}$/.test(code) || /^5\d{5}$/.test(code) ? `1.${code}` : /^(0|3|15|16)\d{4}$/.test(code) ? `0.${code}` : null;
  if (!secid) return { code, price: null, pct: null, source: "东方财富", available: false };
  try {
    const text = await fetchText(`https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43,f170`, 7000, { Referer: "https://quote.eastmoney.com/" });
    const j = JSON.parse(text) as { data?: { f43?: unknown; f170?: unknown } };
    const price = n(j.data?.f43);
    const pctRaw = n(j.data?.f170);
    const pct = pctRaw != null ? pctRaw / 100 : null;
    return { code, price, pct, source: "东方财富", available: price != null || pct != null };
  } catch {
    return { code, price: null, pct: null, source: "东方财富", available: false };
  }
}
