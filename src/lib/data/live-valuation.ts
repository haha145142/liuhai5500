import { createServerFn } from "@tanstack/react-start";
import { calcIndicators } from "../calc/indicators";
import { policyForFund } from "../calc/fund-type-policy";
import type { FundHistoryPoint, FundMetrics, FundQuote } from "../types";
import { fetchText, n, parseMaybeJsonp } from "./fetch-util";
import { crossCheckStockQuotes, type CrossCheckedHolding } from "./live-quote-cross-check";

export type LiveHolding = { code: string; name: string; weight: number; price: number | null; pct: number | null; source: string };

type ValuationAudit = {
  estimateMethod?: string;
  estimateCoverage?: number;
  disclosedWeight?: number;
  usableWeight?: number;
  externalEstimatePct?: number | null;
  estimateDeviation?: number | null;
  estimateValidation?: string;
  quoteCrossCheckedWeight?: number;
  quoteDisagreedWeight?: number;
};

const YJB = "https://fundgz.1234567.com.cn/js";
const HOLDING = "https://fundf10.eastmoney.com/FundArchivesDatas.aspx";
const NAV = "https://api.fund.eastmoney.com/f10/lsjz";
const CACHE = new Map<string, { ts: number; quote: FundQuote & ValuationAudit }>();
const TTL = 20_000;

function chinaNow() { return new Date(Date.now() + 8 * 60 * 60 * 1000); }
function today() { const d = chinaNow(); return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`; }
function htmlEntity(s: string) { return s.replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#39;/g,"'").trim(); }
function stripTags(s: string) { return htmlEntity(s.replace(/<[^>]+>/g," ").replace(/\s+/g," ")); }

async function getBase(code: string) {
  const [gzRaw, histRaw] = await Promise.all([
    fetchText(`${YJB}/${code}.js?rt=${Date.now()}`, 8000, { Referer:"https://fund.eastmoney.com/" }),
    fetchText(`${NAV}?fundCode=${code}&pageIndex=1&pageSize=300`, 10000, { Referer:"https://fund.eastmoney.com/" }),
  ]);
  const gz = parseMaybeJsonp(gzRaw) as any;
  const hj = parseMaybeJsonp(histRaw) as any;
  const ordered: FundHistoryPoint[] = (hj?.Data?.LSJZList || []).map((x:any)=>({date:String(x.FSRQ||""),nav:n(x.DWJZ)??0,changePct:n(x.JZZZL)})).filter((x:FundHistoryPoint)=>x.date&&x.nav>0).reverse();
  const latest = ordered.at(-1);
  return { gz, ordered, latest };
}

async function getHoldings(code: string): Promise<LiveHolding[]> {
  const raw = await fetchText(`${HOLDING}?type=jjcc&code=${code}&topline=10&year=&month=&rt=${Date.now()}`, 10000, { Referer:"https://fund.eastmoney.com/" });
  const m = raw.match(/content:\\?"([\s\S]*?)\\?",arryear/i);
  if (!m) return [];
  let html = m[1];
  try { html = JSON.parse(`"${html}"`); } catch {}
  const out: LiveHolding[] = [];
  const seen = new Set<string>();
  for (const tr of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = tr[1];
    const codeMatch = row.match(/(?:quote\.eastmoney\.com\/|href=['"][^'"]*?)(?:sz|sh)(\d{6})/i) || row.match(/(?:0|1)\.(\d{6})/);
    if (!codeMatch) continue;
    const stockCode = codeMatch[1];
    if (seen.has(stockCode)) continue;
    const anchors = [...row.matchAll(/<a[^>]*>([^<]+)<\/a>/gi)].map(x=>stripTags(x[1])).filter(Boolean);
    const name = anchors.find(x=>!/^\d{6}$/.test(x)) || "";
    const values = [...row.matchAll(/<td[^>]*class=['"][^'"]*(?:tor|toc)[^'"]*['"][^>]*>([\s\S]*?)<\/td>/gi)].map(x=>stripTags(x[1])).map(x=>n(x));
    const weights = values.filter((x):x is number=>x!=null&&x>0&&x<=15);
    const weight = weights.at(-1);
    if (!weight) continue;
    seen.add(stockCode);
    out.push({code:stockCode,name,weight,price:null,pct:null,source:"东方财富基金持仓"});
    if (out.length>=10) break;
  }
  return out;
}

async function getStockQuotes(holdings: LiveHolding[]): Promise<CrossCheckedHolding[]> {
  return crossCheckStockQuotes(holdings);
}

function buildEstimate(nav:number|null,holdings:Array<LiveHolding & Partial<Pick<CrossCheckedHolding,"quoteStatus">>>,externalPct:number|null) {
  const totalDisclosed = holdings.reduce((s,h)=>s+Math.max(0,h.weight),0);
  const usable = holdings.filter(h=>h.weight>0&&h.pct!=null);
  const usableWeight = usable.reduce((s,h)=>s+h.weight,0);
  if (nav==null || usableWeight<=0 || totalDisclosed<=0) return {estimate:null,pct:null,disclosedWeight:totalDisclosed,usableWeight,coverage:usableWeight,coverageOfDisclosed:totalDisclosed?usableWeight/totalDisclosed*100:0,deviation:null,confidence:"low" as const,validation:"无法验证",crossCheckedWeight:0,disagreedWeight:0};

  const weightedContribution = usable.reduce((s,h)=>s+h.weight*(h.pct as number),0)/100;
  const estimate = nav*(1+weightedContribution/100);
  const coverage = Math.min(100,usableWeight);
  const coverageOfDisclosed = totalDisclosed?usableWeight/totalDisclosed*100:0;
  const deviation = externalPct==null?null:Math.abs(weightedContribution-externalPct);
  const crossCheckedWeight = usable.filter(h=>h.quoteStatus==="cross_checked").reduce((s,h)=>s+h.weight,0);
  const disagreedWeight = usable.filter(h=>h.quoteStatus==="disagreed").reduce((s,h)=>s+h.weight,0);
  const quoteCrossRate = usableWeight>0 ? crossCheckedWeight/usableWeight : 0;
  let confidence:"high"|"medium"|"low" = coverage>=60&&coverageOfDisclosed>=70?"high":coverage>=35&&coverageOfDisclosed>=50?"medium":"low";
  if (quoteCrossRate < 0.5 || disagreedWeight / usableWeight > 0.2) confidence = "low";
  else if (quoteCrossRate < 0.7 && confidence === "high") confidence = "medium";
  let validation = "无法验证";
  if (deviation!=null) {
    if (deviation<=0.35) validation="一致";
    else if (deviation<=0.9) validation="轻微偏差";
    else { validation="明显偏差"; confidence="low"; }
  }
  return {estimate,pct:weightedContribution,disclosedWeight:totalDisclosed,usableWeight,coverage,coverageOfDisclosed,deviation,confidence,validation,crossCheckedWeight,disagreedWeight};
}

export const getCalculatedFund = createServerFn({method:"POST"})
  .validator((input:{code:string})=>input)
  .handler(async({data}):Promise<FundQuote & ValuationAudit & {liveHoldings?:CrossCheckedHolding[];coverageOfDisclosed?:number}>=>{
    const code=data.code.trim();
    const hit=CACHE.get(code); if(hit&&Date.now()-hit.ts<TTL) return hit.quote;
    try {
      const {gz,ordered,latest}=await getBase(code);
      const nav=n(gz?.dwjz)??latest?.nav??null;
      const navDate=gz?.jzrq?String(gz.jzrq):latest?.date??null;
      const fundName=String(gz?.name||code);
      const fundType=String(gz?.fundtype||"基金");
      const policy=policyForFund(fundType,fundName);
      const externalPct=n(gz?.gszzl??gz?.vgszzl??gz?.zsgzzl);
      const holdings=policy.allowAshareLookThrough ? await getStockQuotes(await getHoldings(code)) : [];
      const result=policy.allowAshareLookThrough ? buildEstimate(nav,holdings,externalPct) : { estimate:null,pct:null,disclosedWeight:0,usableWeight:0,coverage:0,coverageOfDisclosed:0,deviation:null,confidence:"low" as const,validation:"该类型不适用A股穿透估值",crossCheckedWeight:0,disagreedWeight:0 };
      const history=ordered.map(x=>x.nav);
      const weekBase=ordered[Math.max(0,ordered.length-6)];
      const monthBase=ordered[Math.max(0,ordered.length-22)];
      const weekPct=latest&&weekBase?.nav?((latest.nav/weekBase.nav)-1)*100:null;
      const monthPct=latest&&monthBase?.nav?((latest.nav/monthBase.nav)-1)*100:null;
      const metrics:FundMetrics|null=calcIndicators(history);
      const officialToday=navDate===today();
      const officialDayPct = officialToday ? (n(gz?.jzzzl??gz?.rzzl)??latest?.changePct??null) : null;
      const quote:FundQuote & ValuationAudit & {liveHoldings?:CrossCheckedHolding[];coverageOfDisclosed?:number}={
        code,name:fundName,type:fundType,nav,navDate,
        estimate:result.estimate,estimatePct:result.pct,estimateTime:result.estimate!=null?new Date().toISOString():null,
        dayPct:officialToday?officialDayPct:result.pct,
        weekPct,monthPct,history,historyPoints:ordered,metrics,
        source:result.estimate!=null
          ?`自有穿透估值 · 前十大重仓 × 双源实时行情 · ${result.validation}${externalPct!=null?` · 参考源差 ${result.deviation?.toFixed(2)}个百分点`:""}`
          :policy.allowLiveEstimate
            ?`自有估值暂不可用 · ${result.validation}`
            :`按基金类型采用官方净值模式 · ${policy.reason}`,
        officialNavPublished:officialToday,
        valuationStatus:officialToday?"official_nav":result.estimate!=null?"estimate":nav!=null?"waiting_official_nav":"unavailable",
        estimateConfidence:result.confidence,
        liveHoldings:holdings,
        estimateMethod:policy.allowAshareLookThrough?"已披露重仓权重 × 实时资产涨跌；重仓行情双源交叉；未覆盖部分不擅自猜测":policy.reason,
        estimateCoverage:result.coverage,
        disclosedWeight:result.disclosedWeight,
        usableWeight:result.usableWeight,
        coverageOfDisclosed:result.coverageOfDisclosed,
        externalEstimatePct:externalPct,
        estimateDeviation:result.deviation,
        estimateValidation:result.validation,
        quoteCrossCheckedWeight:result.crossCheckedWeight,
        quoteDisagreedWeight:result.disagreedWeight,
        historyMae20:null,
        historySample20:0,
        historyMaxError:null,
        historyP95Error:null,
        historyMae5:null
      };
      CACHE.set(code,{ts:Date.now(),quote});
      return quote;
    } catch {
      return {code,name:code,type:"基金",nav:null,navDate:null,estimate:null,estimatePct:null,estimateTime:null,dayPct:null,weekPct:null,monthPct:null,history:[],historyPoints:[],metrics:null,source:"自有估值引擎暂不可用",officialNavPublished:false,valuationStatus:"unavailable",estimateConfidence:"low",historyMae20:null,historySample20:0,historyMaxError:null,historyP95Error:null,historyMae5:null};
    }
  });
