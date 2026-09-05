import type { FundQuote, Holding } from "../types";
import { getMarketPhase } from "../market-hours.ts";
import { tradingDateLabel } from "../data/trading-day.ts";

type ReturnQuote={price:number|null;mode:"live_estimate"|"official_today"|"latest_official"|"none"};
export type HoldingReturn={costValue:number;marketValue:number|null;holdingPnl:number|null;holdingPnlPct:number|null;todayPnl:number|null;todayPnlPct:number|null;previousOfficialNav:number|null;price:number|null;quoteMode:ReturnQuote["mode"]};
const LIVE_ESTIMATE_MAX_AGE_MS=10*60_000;
const NAV_EPSILON=1e-6;
function finitePositive(v:number|null|undefined){return v!=null&&Number.isFinite(v)&&v>0?v:null;}
function sameChinaDate(value:string|null|undefined,now=new Date()){
  if(!value)return false;
  const m=String(value).trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if(!m)return false;
  const cn=new Date(now.getTime()+8*60*60*1000);
  return Number(m[1])===cn.getUTCFullYear()&&Number(m[2])===cn.getUTCMonth()+1&&Number(m[3])===cn.getUTCDate();
}
function parseEstimateTime(value:string){
  const raw=String(value).trim();
  if(!raw)return NaN;
  const normalized=raw.includes("T")?raw:raw.replace(/\s+/,"T");
  const withZone=/(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized)?normalized:`${normalized}+08:00`;
  const parsed=Date.parse(withZone);
  return Number.isFinite(parsed)?parsed:NaN;
}
function isFreshEstimate(fund:FundQuote,now=new Date()){
  if(!fund.estimateTime)return false;
  const parsed=parseEstimateTime(fund.estimateTime);
  if(!Number.isFinite(parsed))return false;
  const age=now.getTime()-parsed;
  return age>=0&&age<=LIVE_ESTIMATE_MAX_AGE_MS;
}
function isValidatedIntraday(fund:FundQuote){
  if(fund.estimateConfidence==="high"||fund.estimateConfidence==="medium")return true;
  const routes=fund.estimateRoutes??[];
  const distinctSources=new Set(routes.map((r)=>String(r.source||"")).filter(Boolean));
  return distinctSources.size>=2&&(fund.estimateRouteWarning==null);
}
function selectReturnQuote(fund:FundQuote|undefined,now=new Date()):ReturnQuote{
  if(!fund)return{price:null,mode:"none"};
  const phase=getMarketPhase(now);
  const latestTradingDate=tradingDateLabel(now);
  const officialFlag=finitePositive(fund.nav)!=null&&fund.officialNavPublished===true&&fund.valuationStatus==="official_nav";
  const latestTradingDayOfficial=finitePositive(fund.nav)!=null&&fund.navDate===latestTradingDate&&phase!=="morning"&&phase!=="afternoon"&&phase!=="lunch";
  if(officialFlag||latestTradingDayOfficial)return{price:finitePositive(fund.nav),mode:"official_today"};
  const current=finitePositive(fund.estimate);
  const sameDayEstimate=current!=null&&isValidatedIntraday(fund)&&(fund.valuationStatus==="estimate"||fund.valuationStatus==="live_estimate")&&fund.officialNavPublished!==true&&sameChinaDate(fund.estimateTime,now);
  if(sameDayEstimate&&(phase==="postclose"||isFreshEstimate(fund,now)))return{price:current,mode:"live_estimate"};
  if(phase==="morning"||phase==="afternoon")return{price:null,mode:"none"};
  const nav=finitePositive(fund.nav);
  if(nav!=null)return{price:nav,mode:"latest_official"};
  return{price:null,mode:"none"};
}
function previousOfficialNav(fund:FundQuote|undefined,currentPrice:number|null,mode:ReturnQuote["mode"]){
  if(!fund||currentPrice==null)return null;
  const latest=finitePositive(fund.nav);
  if(mode==="live_estimate")return latest;

  const points=Array.isArray(fund.historyPoints)
    ? fund.historyPoints.filter((x)=>Number.isFinite(x.nav)&&x.nav>0&&typeof x.date==="string"&&x.date.length>0)
    : [];
  if(mode==="official_today"&&fund.navDate){
    const previous=points.filter((x)=>x.date<fund.navDate).at(-1)?.nav;
    const previousNav=finitePositive(previous);
    if(previousNav!=null)return previousNav;
  }

  if(latest!=null&&Math.abs(currentPrice-latest)>Math.max(NAV_EPSILON,latest*NAV_EPSILON))return latest;
  const history=Array.isArray(fund.history)?fund.history.filter(x=>Number.isFinite(x)&&x>0):[];
  if(history.length>=2)return history[history.length-2];
  return history.length===1?history[0]:null;
}
export function calcHoldingReturn(holding:Holding,fund?:FundQuote,now=new Date()):HoldingReturn{
  const shares=Number(holding.shares); const cost=Number(holding.cost); const safeShares=Number.isFinite(shares)&&shares>0?shares:0; const safeCost=finitePositive(cost)??0; const costValue=safeShares*safeCost; const quote=selectReturnQuote(fund,now); const marketValue=quote.price!=null?safeShares*quote.price:null; const holdingPnl=marketValue!=null?marketValue-costValue:null; const holdingPnlPct=holdingPnl!=null&&costValue>0?holdingPnl/costValue*100:null; const previousNav=previousOfficialNav(fund,quote.price,quote.mode); const canToday=quote.price!=null&&previousNav!=null&&(quote.mode==="live_estimate"||quote.mode==="official_today"); const todayPnl=canToday?(quote.price!-previousNav!)*safeShares:null; const todayPnlPct=canToday&&previousNav!>0?(quote.price!-previousNav!)/previousNav!*100:null; return{costValue,marketValue,holdingPnl,holdingPnlPct,todayPnl,todayPnlPct,previousOfficialNav:previousNav,price:quote.price,quoteMode:quote.mode};
}
export function calcPortfolioReturn(holdings:Holding[],funds:Record<string,FundQuote>,now=new Date()){
  const results=holdings.map(h=>calcHoldingReturn(h,funds[h.code],now));
  const costValue=results.reduce((s,x)=>s+x.costValue,0);
  const priced=results.filter(x=>x.marketValue!=null);
  const pricedCostValue=priced.reduce((s,x)=>s+x.costValue,0);
  const marketValue=priced.reduce((s,x)=>s+(x.marketValue??0),0);
  const holdingPnl=priced.reduce((s,x)=>s+(x.holdingPnl??0),0);
  const todayResults=results.filter(x=>x.todayPnl!=null);
  const todayPnl=todayResults.length>0?todayResults.reduce((s,x)=>s+(x.todayPnl??0),0):null;
  const todayBaseValue=results.reduce((s,x,i)=>s+(x.todayPnl!=null&&x.previousOfficialNav!=null?x.previousOfficialNav!*Number(holdings[i]?.shares||0):0),0);
  const pricedHoldingPnlPct=pricedCostValue>0?holdingPnl/pricedCostValue*100:null;
  const fullHoldingPnlPct=costValue>0&&priced.length===holdings.length?holdingPnl/costValue*100:null;
  const todayPnlPct=todayPnl!=null&&todayBaseValue>0?todayPnl/todayBaseValue*100:null;
  return{costValue,marketValue,holdingPnl,holdingPnlPct:fullHoldingPnlPct,pricedHoldingPnlPct,todayPnl,todayPnlPct,pricedCount:priced.length,totalCount:holdings.length,pricedCostValue,coveragePct:holdings.length>0?priced.length/holdings.length*100:100};
}
