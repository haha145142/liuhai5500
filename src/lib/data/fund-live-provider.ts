import { fetchText, n, parseMaybeJsonp } from "./fetch-util";
import { isChinaTradingSession } from "./market-session";

export type LiveFundQuote = {
  code: string;
  name: string;
  type: string;
  nav: number | null;
  estimate: number | null;
  pct: number | null;
  vgszzl?: number | null;
  zsgzzl?: number | null;
  jzzzl?: number | null;
  rzzl?: number | null;
  time: string | null;
  date: string | null;
  source: string;
};

function cleanCode(v: unknown) {
  const s = String(v ?? "").trim();
  return /^\d{6}$/.test(s) ? s : "";
}

function chinaDateKey() {
  const d = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function isIntradayTimestamp(value: string | null, today = chinaDateKey()) {
  if (!value) return false;
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10) === today;
  if (/^\d{8}/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` === today;
  return /^\d{1,2}:\d{2}(:\d{2})?$/.test(s);
}

function scan(value: unknown, code: string, depth = 0): LiveFundQuote | null {
  if (depth > 7 || value == null) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = scan(item, code, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  const foundCode = cleanCode(o.FCODE ?? o.fundcode ?? o.FundCode ?? o.code);
  const estimate = n(o.GSZ ?? o.gsz ?? o.ESTIMATE ?? o.estimatedNav ?? o.GZJZ);
  const pct = n(o.GSZZL ?? o.gszzl ?? o.ChangeRatio ?? o.changeRatio ?? o.estimateChange);
  const nav = n(o.NAV ?? o.nav ?? o.DWJZ ?? o.dwjz);
  const time = o.GZTIME ?? o.gztime ?? o.Gtime ?? o.time;
  const date = o.PDATE ?? o.jzrq ?? o.FSRQ ?? o.date;
  const vgszzl = n(o.VGSZZL ?? o.vgszzl);
  const zsgzzl = n(o.ZSGZZL ?? o.zsgzzl);
  const jzzzl = n(o.JZZZL ?? o.jzzzl);
  const rzzl = n(o.RZZL ?? o.rzzl);
  if ((foundCode === code || !foundCode) && (estimate != null || pct != null) && (foundCode === code || depth >= 2)) {
    return {
      code,
      name: String(o.SHORTNAME ?? o.name ?? "").trim(),
      type: String(o.FTYPE ?? o.fundtype ?? o.type ?? "").trim(),
      nav,
      estimate,
      pct,
      vgszzl,
      zsgzzl,
      jzzzl,
      rzzl,
      time: time == null ? null : String(time),
      date: date == null ? null : String(date),
      source: "实时基金估值",
    };
  }
  for (const item of Object.values(o)) {
    const hit = scan(item, code, depth + 1);
    if (hit) return hit;
  }
  return null;
}

async function tryJson(url: string, code: string, source: string) {
  try {
    const raw = await fetchText(url, 9000, { Referer: "https://fund.eastmoney.com/" });
    const parsed = parseMaybeJsonp(raw);
    const hit = scan(parsed, code);
    return hit ? { ...hit, source } : null;
  } catch { return null; }
}

async function getFundType(code: string) {
  try {
    const raw = await fetchText(`https://fundmobapi.eastmoney.com/FundMNewApi/FundMNStopWatch?FCODE=${encodeURIComponent(code)}&deviceid=123&plat=Iphone&version=6.3.5&appVersion=6.3.5`, 7000, { Referer: "https://fund.eastmoney.com/" });
    const j = parseMaybeJsonp(raw) as any;
    return String(j?.Datas?.FTYPE ?? j?.Datas?.fundtype ?? j?.Data?.FTYPE ?? j?.data?.FTYPE ?? "").trim();
  } catch { return ""; }
}

export async function getLiveFundQuote(code: string): Promise<LiveFundQuote | null> {
  const urls: [string, string][] = [
    [`https://fundcomapi.tiantianfunds.com/mm/newCore/FundValuationLast?FCODES=${encodeURIComponent(code)}&FIELDS=FCODE,SHORTNAME,FTYPE,GSZZL,GZTIME,GSZ,NAV,PDATE&_=${Date.now()}`, "天天基金/东方财富实时估值"],
    [`https://fundcomapi.tiantianfunds.com/mm/fundTrade/FundValuationDetail?FCODE=${encodeURIComponent(code)}&_=${Date.now()}`, "天天基金实时估值明细"],
    [`https://web.ifzq.gtimg.cn/fund/newfund/fundSsgz/getSsgz?app=web&symbol=jj${encodeURIComponent(code)}&_=${Date.now()}`, "腾讯基金分时估值"],
  ];
  const [type, ...rest] = await Promise.all([getFundType(code), ...urls.map(([url, source]) => tryJson(url, code, source))]);
  const today = chinaDateKey();
  const valid = rest.filter((x): x is LiveFundQuote => !!x && (x.estimate != null || x.pct != null));
  if (!valid.length) return null;

  const fresh = valid.filter((x) => isIntradayTimestamp(x.time, today) || isIntradayTimestamp(x.date, today));
  const inSession = isChinaTradingSession();
  if (inSession && !fresh.length) return null;
  const pool = fresh.length ? fresh : valid;
  const complete = pool.filter((x) => x.estimate != null && x.pct != null);
  if (!complete.length) {
    const fallback = pool[0];
    return fallback ? { ...fallback, type: fallback.type || type } : null;
  }

  const consensus = complete.filter((x) => complete.every((y) => Math.abs((x.pct as number) - (y.pct as number)) <= 0.15));
  const source = consensus.length >= 2 ? "多源实时估值一致" : complete.length >= 2 ? "多源实时估值" : complete[0].source;
  const chosen = consensus.length ? consensus[0] : complete[0];
  if (chosen.time == null && chosen.date != null && !isIntradayTimestamp(chosen.date, today)) return null;
  return { ...chosen, source, type: chosen.type || type };
}

export async function getLiveFundQuotes(codes: string[]): Promise<Map<string, LiveFundQuote>> {
  const unique = [...new Set(codes.map(cleanCode).filter(Boolean))];
  const pairs = await Promise.all(unique.map(async (code) => [code, await getLiveFundQuote(code)] as const));
  return new Map(pairs.filter((x): x is readonly [string, LiveFundQuote] => !!x[1]));
}
