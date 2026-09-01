import type { FundQuote, Holding } from "../types";
import { isChinaTradingSession } from "@/lib/data/market-session";

type ReturnQuote={price:number|null;mode:"live_estimate"|"official_today"|"latest_official"|"none"};
export type HoldingReturn={costValue:number;marketValue:number|null;holdingPnl:number|null;holdingPnlPct:number|null;todayPnl:number|null;todayPnlPct:number|null;previousOfficialNav:number|null;price:number|null;quoteMode:ReturnQuote["mode"]};
function finitePositive(v:number|null|undefined){return v!=null&&Number.isFinite(v)&&v>0?v:null;}
function selectReturnQuote(fund:FundQuote|undefined):ReturnQuote{
  if(!fund)return{price:null,mode:"none"};
  const official=finitePositive(fund.nav)!=null&&fund.officialNavPublished===true&&fund.valuationStatus==="official_nav";
  if(official)return{price:finitePositive(fund.nav),mode:"official_today"};
  const current=finitePositive(fund.estimate);
  if(current!=null&&(fund.valuationStatus==="estimate"||fund.valuationStatus==="live_estimate")&&fund.officialNavPublished!==true)return{price:current,mode:"live_estimate"};
  // During a trading session, never calculate a holding from yesterday's NAV when
  // no current verified estimate exists. This is the same safety rule as entry preview.
  if(isChinaTradingSession())return{price:null,mode:"none"};
  const nav=finitePositive(fund.nav);
  if(nav!=null)return{price:nav,mode:"latest_official"};
  return{price:null,mode:"none"};
}
function previousOfficialNav(fund:FundQuote|undefined,currentPrice:number|null){
  if(!fund||currentPrice==null)return null; const latest=finitePositive(fund.nav); if(latest!=null&&Math.abs(currentPrice-latest)>Math.max(0.0000001,latest*0.000001))return latest;
  const history=Array.isArray(fund.history)?fund.history.filter(x=>Number.isFinite(x)&&x>0):[]; if(history.length<2)return null; return history[history.length-2];
}
export function calcHoldingReturn(holding:Holding,fund?:FundQuote):HoldingReturn{
  const shares=Number(holding.shares); const cost=Number(holding.cost); const safeShares=Number.isFinite(shares)&&shares>0?shares:0; const safeCost=finitePositive(cost)??0; const costValue=safeShares*safeCost; const quote=selectReturnQuote(fund); const marketValue=quote.price!=null?safeShares*quote.price:null; const holdingPnl=marketValue!=null?marketValue-costValue:null; const holdingPnlPct=holdingPnl!=null&&costValue>0?holdingPnl/costValue*100:null; const previousNav=previousOfficialNav(fund,quote.price); const canToday=quote.price!=null&&previousNav!=null&&(quote.mode==="live_estimate"||quote.mode==="official_today"); const todayPnl=canToday?(quote.price!-previousNav!)*safeShares:null; const todayPnlPct=canToday&&previousNav!>0?(quote.price!-previousNav!)/previousNav!*100:null; return{costValue,marketValue,holdingPnl,holdingPnlPct,todayPnl,todayPnlPct,previousOfficialNav:previousNav,price:quote.price,quoteMode:quote.mode};
}
export function calcPortfolioReturn(holdings:Holding[],funds:Record<string,FundQuote>){const results=holdings.map(h=>calcHoldingReturn(h,funds[h.code]));const costValue=results.reduce((s,x)=>s+x.costValue,0);const priced=results.filter(x=>x.marketValue!=null);const marketValue=priced.reduce((s,x)=>s+(x.marketValue??0),0);const holdingPnl=priced.reduce((s,x)=>s+(x.holdingPnl??0),0);const todayResults=results.filter(x=>x.todayPnl!=null);const todayPnl=todayResults.length===priced.length&&priced.length>0?todayResults.reduce((s,x)=>s+(x.todayPnl??0),0):null;return{costValue,marketValue,holdingPnl,holdingPnlPct:costValue>0&&priced.length===holdings.length?holdingPnl/costValue*100:null,todayPnl,todayPnlPct:todayPnl!=null&&marketValue-todayPnl>0?todayPnl/(marketValue-todayPnl)*100:null,pricedCount:priced.length,totalCount:holdings.length};}
