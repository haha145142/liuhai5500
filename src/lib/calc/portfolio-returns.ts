import type { FundQuote, Holding } from "../types";
import { getMarketPhase } from "../market-hours.ts";
import { tradingDateLabel } from "../data/trading-day.ts";

type ReturnQuote={price:number|null;mode:"live_estimate"|"official_today"|"latest_official"|"none";officialPrice?:number|null;estimatePrice?:number|null};
export type HoldingReturn={costValue:number;marketValue:number|null;holdingPnl:number|null;holdingPnlPct:number|null;todayPnl:number|null;todayPnlPct:number|null;previousOfficialNav:number|null;price:number|null;quoteMode:ReturnQuote["mode"]};
const LIVE_ESTIMATE_MAX_AGE_MS=10*60_000;
const NAV_EPSILON=1e-6;
const INTRADAY_STORAGE_KEY="fund_ai_pro_intraday_estimates_v1";

type StoredEstimate={date:string;estimate:number;estimatePct:number;time:string|null;morningEstimate?:number;morningPct?:number;morningTime?:string|null;maxEstimate?:number;maxPct?:number;maxTime?:string|null};
function finitePositive(v:number|null|undefined){return v!=null&&Number.isFinite(v)&&v>0?v:null;}
function finiteNumber(v:number|null|undefined){return v!=null&&Number.isFinite(v)?v:null;}
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
function chinaDate(now=new Date()){
  const cn=new Date(now.getTime()+8*60*60*1000);
  return `${cn.getUTCFullYear()}-${String(cn.getUTCMonth()+1).padStart(2,"0")}-${String(cn.getUTCDate()).padStart(2,"0")}`;
}
function localStoredMap():Record<string,StoredEstimate>{
  if(typeof window==="undefined")return {};
  try{
    const raw=JSON.parse(window.localStorage.getItem(INTRADAY_STORAGE_KEY)||"{}");
    return raw&&typeof raw==="object"?raw as Record<string,StoredEstimate>:{};
  }catch{return {};}
}
function readStoredEstimate(code:string,now=new Date()):StoredEstimate|null{
  const item=localStoredMap()[code];
  return item&&item.date===chinaDate(now)?item:null;
}
function rememberEstimate(code:string,fund:FundQuote,now=new Date()){
  if(typeof window==="undefined"||fund.estimate==null||fund.estimatePct==null||!Number.isFinite(fund.estimate)||!Number.isFinite(fund.estimatePct)||!sameChinaDate(fund.estimateTime,now))return;
  const date=chinaDate(now); const map=localStoredMap(); const prev=map[code]&&map[code].date===date?map[code]:null;
  const pct=fund.estimatePct; const parsed=fund.estimateTime?parseEstimateTime(fund.estimateTime):NaN; const hour=Number.isFinite(parsed)?new Date(parsed).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai",hour:"2-digit",minute:"2-digit",hour12:false}):null;
  const isMorning=Number.isFinite(parsed)?(()=>{const d=new Date(parsed);const h=Number(d.toLocaleString("en-US",{timeZone:"Asia/Shanghai",hour:"2-digit",hour12:false}));const m=Number(d.toLocaleString("en-US",{timeZone:"Asia/Shanghai",minute:"2-digit"}));return h<11||(h===11&&m<=30);})():false;
  const next:StoredEstimate={date,estimate:fund.estimate,estimatePct:pct,time:fund.estimateTime,morningEstimate:prev?.morningEstimate,morningPct:prev?.morningPct,morningTime:prev?.morningTime,maxEstimate:prev?.maxEstimate,maxPct:prev?.maxPct,maxTime:prev?.maxTime};
  if(!next.maxPct||Math.abs(pct)>Math.abs(next.maxPct)){next.maxEstimate=fund.estimate;next.maxPct=pct;next.maxTime=fund.estimateTime;}
  if(isMorning&&next.morningPct==null){next.morningEstimate=fund.estimate;next.morningPct=pct;next.morningTime=fund.estimateTime;}
  map[code]=next;
  try{window.localStorage.setItem(INTRADAY_STORAGE_KEY,JSON.stringify(map));}catch{}
}
function fusedEstimatePct(fund:FundQuote){
  const model=finiteNumber(fund.estimatePct); const external=finiteNumber(fund.externalEstimatePct);
  if(model==null)return external;
  if(external==null)return model;
  const coverage=Math.max(0,Math.min(1,(fund.estimateCoverage??0)/100));
  const spread=Math.abs(model-external);
  let modelWeight=coverage>=0.8?0.75:coverage>=0.5?0.6:0.45;
  if(spread>=2&&coverage<0.7)modelWeight=0.35;
  if(spread>=2&&coverage>=0.7)modelWeight=0.65;
  return model*modelWeight+external*(1-modelWeight);
}
function estimatePrice(fund:FundQuote){
  const pct=fusedEstimatePct(fund); const nav=finitePositive(fund.nav);
  if(pct==null||nav==null)return null;
  return nav*(1+pct/100);
}
function selectReturnQuote(fund:FundQuote|undefined,now=new Date()):ReturnQuote{
  if(!fund)return{price:null,mode:"none"};
  const phase=getMarketPhase(now);
  const latestTradingDate=tradingDateLabel(now);
  const officialFlag=finitePositive(fund.nav)!=null&&fund.officialNavPublished===true&&fund.valuationStatus==="official_nav";
  const latestTradingDayOfficial=finitePositive(fund.nav)!=null&&fund.navDate===latestTradingDate&&phase!=="morning"&&phase!=="afternoon"&&phase!=="lunch";
  const current=finitePositive(fund.estimate);
  const sameDayEstimate=current!=null&&fund.valuationStatus!=="official_nav"&&fund.officialNavPublished!==true&&sameChinaDate(fund.estimateTime,now);
  if(sameDayEstimate&&(isFreshEstimate(fund,now)||phase==="postclose")){
    rememberEstimate(fund.code,fund,now);
    const fusedPct=fusedEstimatePct(fund);
    const fusedPrice=fusedPct!=null&&finitePositive(fund.nav)!=null?finitePositive(fund.nav)!*(1+fusedPct/100):current;
    return{price:fusedPrice,mode:"live_estimate",officialPrice:officialFlag?finitePositive(fund.nav):null,estimatePrice:fusedPrice};
  }
  if(officialFlag||latestTradingDayOfficial){
    const stored=readStoredEstimate(fund.code,now);
    const sessionPct=finiteNumber(stored?.morningPct??stored?.maxPct??stored?.estimatePct);
    const sessionPrice=finitePositive(fund.nav)!=null&&sessionPct!=null?finitePositive(fund.nav)!*(1+sessionPct/100):stored?.estimate??null;
    return sessionPrice!=null?{price:sessionPrice,mode:"live_estimate",officialPrice:finitePositive(fund.nav),estimatePrice:sessionPrice}:{price:finitePositive(fund.nav),mode:"official_today",officialPrice:finitePositive(fund.nav)};
  }
  if(phase==="morning"||phase==="afternoon")return{price:null,mode:"none"};
  const nav=finitePositive(fund.nav);
  if(nav!=null)return{price:nav,mode:"latest_official",officialPrice:nav};
  return{price:null,mode:"none"};
}
function previousOfficialNav(fund:FundQuote|undefined,currentPrice:number|null,mode:ReturnQuote["mode"]){
  if(!fund||currentPrice==null)return null;
  const latest=finitePositive(fund.nav);
  if(mode==="live_estimate")return latest;
  const points=Array.isArray(fund.historyPoints)?fund.historyPoints.filter((x)=>Number.isFinite(x.nav)&&x.nav>0&&typeof x.date==="string"&&x.date.length>0):[];
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
  const shares=Number(holding.shares); const cost=Number(holding.cost); const safeShares=Number.isFinite(shares)&&shares>0?shares:0; const safeCost=finitePositive(cost)??0; const costValue=safeShares*safeCost; const quote=selectReturnQuote(fund,now);
  const calculationPrice=quote.officialPrice!=null?quote.officialPrice:quote.price; const marketValue=calculationPrice!=null?safeShares*calculationPrice:null; const holdingPnl=marketValue!=null?marketValue-costValue:null; const holdingPnlPct=holdingPnl!=null&&costValue>0?holdingPnl/costValue*100:null;
  const previousNav=previousOfficialNav(fund,calculationPrice,quote.officialPrice!=null?"official_today":quote.mode);
  const canToday=calculationPrice!=null&&previousNav!=null&&(quote.mode==="live_estimate"||quote.mode==="official_today"); const todayPnl=canToday?(calculationPrice!-previousNav!)*safeShares:null; const todayPnlPct=canToday&&previousNav!>0?(calculationPrice!-previousNav!)/previousNav!*100:null;
  return{costValue,marketValue,holdingPnl,holdingPnlPct,todayPnl,todayPnlPct,previousOfficialNav:previousNav,price:quote.price,quoteMode:quote.mode};
}
export function calcPortfolioReturn(holdings:Holding[],funds:Record<string,FundQuote>,now=new Date()){
  const results=holdings.map(h=>calcHoldingReturn(h,funds[h.code],now));
  const costValue=results.reduce((s,x)=>s+x.costValue,0); const priced=results.filter(x=>x.marketValue!=null); const pricedCostValue=priced.reduce((s,x)=>s+x.costValue,0); const marketValue=priced.reduce((s,x)=>s+(x.marketValue??0),0); const holdingPnl=priced.reduce((s,x)=>s+(x.holdingPnl??0),0);
  const todayResults=results.filter(x=>x.todayPnl!=null); const todayPnl=todayResults.length>0?todayResults.reduce((s,x)=>s+(x.todayPnl??0),0):null; const todayBaseValue=results.reduce((s,x,i)=>s+(x.todayPnl!=null&&x.previousOfficialNav!=null?x.previousOfficialNav!*Number(holdings[i]?.shares||0):0),0);
  const pricedHoldingPnlPct=pricedCostValue>0?holdingPnl/pricedCostValue*100:null; const fullHoldingPnlPct=costValue>0&&priced.length===holdings.length?holdingPnl/costValue*100:null; const todayPnlPct=todayPnl!=null&&todayBaseValue>0?todayPnl/todayBaseValue*100:null;
  return{costValue,marketValue,holdingPnl,holdingPnlPct:fullHoldingPnlPct,pricedHoldingPnlPct,todayPnl,todayPnlPct,pricedCount:priced.length,totalCount:holdings.length,pricedCostValue,coveragePct:holdings.length>0?priced.length/holdings.length*100:100};
}
