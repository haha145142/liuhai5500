import { fetchText, n, parseMaybeJsonp } from "./fetch-util";

export type LiveFundQuote = {
  code: string;
  name: string;
  type: string;
  nav: number | null;
  estimate: number | null;
  pct: number | null;
  time: string | null;
  date: string | null;
  source: string;
};

function cleanCode(v: unknown) {
  const s = String(v ?? "").trim();
  return /^\d{6}$/.test(s) ? s : "";
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
  if ((foundCode === code || !foundCode) && (estimate != null || pct != null) && (foundCode === code || depth >= 2)) {
    return { code, name: String(o.SHORTNAME ?? o.name ?? "").trim(), type: String(o.FTYPE ?? o.fundtype ?? o.type ?? "").trim(), nav, estimate, pct, time: time == null ? null : String(time), date: date == null ? null : String(date), source: "实时基金估值" };
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
  const valid = rest.filter((x): x is LiveFundQuote => !!x && (x.estimate != null || x.pct != null));
  if (!valid.length) return null;
  const best = valid.find((x) => x.estimate != null && x.pct != null) ?? valid[0];
  return { ...best, type: best.type || type };
}

export async function getLiveFundQuotes(codes: string[]): Promise<Map<string, LiveFundQuote>> {
  const unique = [...new Set(codes.map(cleanCode).filter(Boolean))];
  const pairs = await Promise.all(unique.map(async (code) => [code, await getLiveFundQuote(code)] as const));
  return new Map(pairs.filter((x): x is readonly [string, LiveFundQuote] => !!x[1]));
}
