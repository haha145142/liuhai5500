import { createServerFn } from "@tanstack/react-start";
import { getCalculatedFund } from "./live-valuation-v2";
import { getMultiSourceQuote, type MultiSourceQuote } from "./multi-source-quotes";
import { tradingDateLabel } from "./trading-day";
import type { FundQuote } from "../types";

type LiveHolding = { code: string; name: string; weight: number; price?: number | null; pct?: number | null; source?: string; quoteStatus?: string };
type AuditStats = { three:number; two:number; single:number; disputed:number; unavailable:number; usableWeight:number; weightedHealth:number; weightedAgreement:number };
function canUse(q:MultiSourceQuote){return q.pct!=null&&["three_source","two_source","single_source"].includes(q.agreement);}
function healthScore(q:MultiSourceQuote){return q.health.length?q.health.reduce((s,h)=>s+h.score,0)/q.health.length:0;}
function agreementScore(q:MultiSourceQuote){return q.agreement==="three_source"?100:q.agreement==="two_source"?80:q.agreement==="single_source"?55:q.agreement==="disputed"?20:0;}
function confidenceFrom(s:AuditStats):"high"|"medium"|"low"{if(s.usableWeight>=60&&s.weightedAgreement>=85&&s.weightedHealth>=80)return"high";if(s.usableWeight>=35&&s.weightedAgreement>=65&&s.weightedHealth>=65)return"medium";return"low";}

export const getValidatedFund=createServerFn({method:"POST"}).validator((input:{code:string})=>input).handler(async({data}):Promise<FundQuote>=>{
  const base=await getCalculatedFund({data:{code:data.code}});
  const latestTradingDate=tradingDateLabel();
  const isCurrentOfficial = base.nav != null && base.navDate === latestTradingDate && base.officialNavPublished === true;
  const normalizedBase: FundQuote = isCurrentOfficial
    ? { ...base, officialNavPublished: true, valuationStatus: "official_nav", estimate: null, estimatePct: null, estimateTime: null, estimateConfidence: "high" }
    : { ...base, officialNavPublished: false, valuationStatus: base.estimate != null ? base.valuationStatus : (base.nav != null ? "waiting_official_nav" : "unavailable") };
  const holdings: LiveHolding[] = ((normalizedBase as FundQuote & { liveHoldings?: LiveHolding[] }).liveHoldings || []);
  if(isCurrentOfficial||!holdings.length||normalizedBase.nav==null)return normalizedBase;
  const validated=await Promise.all(holdings.map(async holding=>({holding,quote:await getMultiSourceQuote(holding.code)})));
  const usable=validated.filter(x=>x.holding.weight>0&&canUse(x.quote));
  if(!usable.length){
    if(normalizedBase.estimate != null){
      return { ...normalizedBase, estimateConfidence:"low", valuationStatus:"stale", source:"上一估值保留 · 当前重仓行情暂缺交叉验证", estimateValidation:"当前未获得双源/三源共识，保留上一可用估值；不得视为今日高可信实时值" };
    }
    return{...normalizedBase,estimate:null,estimatePct:null,estimateConfidence:"low",valuationStatus:normalizedBase.nav!=null?"waiting_official_nav":"unavailable",source:"当前重仓行情均无可验证实时值",estimateValidation:"暂无可验证实时行情；未生成模拟数字"};
  }
  const pct=usable.reduce((s,x)=>s+x.holding.weight*(x.quote.pct as number),0)/100;
  const estimate=normalizedBase.nav*(1+pct/100);
  const stats:AuditStats={three:usable.filter(x=>x.quote.agreement==="three_source").length,two:usable.filter(x=>x.quote.agreement==="two_source").length,single:usable.filter(x=>x.quote.agreement==="single_source").length,disputed:validated.filter(x=>x.quote.agreement==="disputed").length,unavailable:validated.filter(x=>x.quote.agreement==="unavailable").length,usableWeight:usable.reduce((s,x)=>s+x.holding.weight,0),weightedHealth:usable.reduce((s,x)=>s+x.holding.weight*healthScore(x.quote),0)/Math.max(.0001,usable.reduce((s,x)=>s+x.holding.weight,0)),weightedAgreement:usable.reduce((s,x)=>s+x.holding.weight*agreementScore(x.quote),0)/Math.max(.0001,usable.reduce((s,x)=>s+x.holding.weight,0))};
  const coverage=Math.min(100,stats.usableWeight);const health=Math.round(stats.weightedHealth);const agreement=Math.round(stats.weightedAgreement);
  const confidence=confidenceFrom(stats);
  const method=stats.single>0&&stats.two===0&&stats.three===0?"单源实时行情":stats.three>0?"三源/双源实时行情校验":"双源/单源实时行情校验";
  return{...normalizedBase,estimate,estimatePct:pct,estimateConfidence:confidence,estimateCoverage:coverage,usableWeight:stats.usableWeight,source:`自有穿透估值 · ${method} · 健康${health}`,estimateValidation:`三源一致 ${stats.three} · 双源一致 ${stats.two} · 单源采用 ${stats.single} · 分歧 ${stats.disputed} · 覆盖 ${coverage.toFixed(1)}% · 一致度 ${agreement}`,liveHoldings:holdings.map(h=>{const hit=validated.find(x=>x.holding.code===h.code);if(!hit)return h;const q=hit.quote;const isUsable=q.pct!=null&&["three_source","two_source","single_source"].includes(q.agreement);const label=q.agreement==="three_source"?"三源一致":q.agreement==="two_source"?"双源一致":q.agreement==="single_source"?"单源实时":q.agreement==="disputed"?"来源分歧":"暂无行情";return{...h,price:isUsable?q.price:null,pct:isUsable?q.pct:null,source:label};})}as FundQuote;
});
