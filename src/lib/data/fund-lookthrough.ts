import { createServerFn } from "@tanstack/react-start";
import { fetchText, n, parseMaybeJsonp } from "./fetch-util";
import type { FundHistoryPoint } from "../types";
const NAV = "https://api.fund.eastmoney.com/f10/lsjz";
export const getFundHistory = createServerFn({ method: "GET" }).validator((input:{code:string;pageSize?:number})=>input).handler(async ({data}): Promise<FundHistoryPoint[]> => {
  const code = data.code.trim();
  if (!/^\d{6}$/.test(code)) return [];
  const pageSize = Math.max(200, Math.min(Number(data.pageSize) || 2500, 2500));
  try {
    const raw = await fetchText(`${NAV}?fundCode=${encodeURIComponent(code)}&pageIndex=1&pageSize=${pageSize}`, 12_000, { Referer: "https://fund.eastmoney.com/" });
    const j = parseMaybeJsonp(raw) as any;
    return (j?.Data?.LSJZList || []).map((x:any)=>({ date:String(x.FSRQ||""), nav:n(x.DWJZ), changePct:n(x.JZZL) }))
      .filter((x:FundHistoryPoint)=>/^\d{4}-\d{2}-\d{2}$/.test(x.date) && x.nav != null && x.nav > 0)
      .reverse();
  } catch { return []; }
});
