import { createServerFn } from "@tanstack/react-start";
import { getValidatedFund } from "./validated-fund";
import { getDirectFundFallback } from "./fund-direct-fallback";
import { withEstimateSafety } from "./estimate-safety";
import { getMarketPhase } from "../market-hours";
import { cnTime } from "../format";
import type { FundQuote } from "../types";

const CACHE_TTL_MS = 20_000;
const RECENT = new Map<string, { at: number; value: FundQuote }>();
const IN_FLIGHT = new Map<string, Promise<FundQuote>>();

function hasUsableFundData(quote: FundQuote | null | undefined) { return !!quote && (quote.nav != null || quote.estimate != null || quote.historyPoints.length > 0 || quote.metrics != null); }
function chinaDateLabel(date = new Date()) { const t = cnTime(date); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`; }
function isTodayEstimate(quote: FundQuote, now = new Date()) { return quote.estimate != null && quote.estimatePct != null && quote.valuationStatus === "estimate" && !!quote.estimateTime && quote.estimateTime.slice(0, 10) === chinaDateLabel(now); }
function isTodayOfficial(quote: FundQuote, now = new Date()) { return !!quote.nav && quote.navDate === chinaDateLabel(now) && quote.officialNavPublished === true; }

async function loadFund(code: string): Promise<FundQuote> {
  const phase = getMarketPhase();
  if (phase === "morning" || phase === "afternoon" || phase === "lunch") {
    try { const validated = await getValidatedFund({ data: { code } }); if (hasUsableFundData(validated)) return withEstimateSafety(validated); } catch {}
    try { const direct = await getDirectFundFallback({ data: { code } }); if (direct && hasUsableFundData(direct)) return withEstimateSafety(direct); } catch {}
  } else {
    try { const validated = await getValidatedFund({ data: { code } }); if (hasUsableFundData(validated)) return withEstimateSafety(validated); } catch {}
    try { const direct = await getDirectFundFallback({ data: { code } }); if (direct && hasUsableFundData(direct)) return withEstimateSafety(direct); } catch {}
  }
  return withEstimateSafety({ code, name: code, type: "基金", nav: null, navDate: null, estimate: null, estimatePct: null, estimateTime: null, dayPct: null, weekPct: null, monthPct: null, history: [], historyPoints: [], metrics: null, source: "基金数据源暂不可用 · 已保存本地持仓", officialNavPublished: false, valuationStatus: "unavailable", estimateConfidence: "low", historyMae20: null, historySample20: 0, historyMaxError: null, historyP95Error: null, historyMae5: null });
}

export const getResilientFund = createServerFn({ method: "POST" }).validator((input:{code:string})=>input).handler(async({data}):Promise<FundQuote>=>{
  const code=data.code.trim();
  if(!/^\d{6}$/.test(code)) return loadFund(code);
  const recent=RECENT.get(code); const phase=getMarketPhase(); const now=new Date();
  if(recent&&Date.now()-recent.at<CACHE_TTL_MS&&hasUsableFundData(recent.value)) {
    if(phase==="morning"||phase==="afternoon"||phase==="lunch") {
      if(isTodayEstimate(recent.value,now)||isTodayOfficial(recent.value,now)) return recent.value;
    } else return recent.value;
  }
  const running=IN_FLIGHT.get(code); if(running) return running;
  const request=loadFund(code).then(value=>{if(hasUsableFundData(value)) RECENT.set(code,{at:Date.now(),value});return value;}).finally(()=>IN_FLIGHT.delete(code));
  IN_FLIGHT.set(code,request); return request;
});