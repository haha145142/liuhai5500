import { createServerFn } from "@tanstack/react-start";
import { fitHiddenSectorRegression, persistentDrifts, type HiddenSectorFit, type RegressionFactor } from "../calc/hidden-sector-regression";
import { getFund } from "./server";
import { fetchText, n, parseMaybeJsonp } from "./fetch-util";
import { SECTOR_RULES } from "./sectors";
import { getFundDeepReport } from "./fund-lookthrough-deep";

type SectorHistoryPoint={date:string;close:number};
export type HiddenSectorRegressionReport={code:string;name:string;asOf:string;sample:number;r2:number|null;residualPct:number|null;weights:{id:string;name:string;weightPct:number;disclosedPct:number;deltaPct:number}[];drifts:{id:string;name:string;inferredPct:number;disclosedPct:number;deltaPct:number;persistentWindows:number;probableRebalance:boolean}[];confidence:"high"|"medium"|"low"|"unavailable";notes:string[]};
const CACHE=new Map<string,{at:number;report:HiddenSectorRegressionReport}>();
const TTL=15*60_000;
const selected=SECTOR_RULES.filter((x)=>x.id!=="space"&&x.id!=="lithium").slice(0,14);
function chinaDate(){const d=new Date(Date.now()+8*60*60*1000);return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;}
async function getSectorHistory(code:string):Promise<SectorHistoryPoint[]>{try{const raw=await fetchText(`https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=90.${encodeURIComponent(code)}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=1&end=20500101&lmt=180&_=${Date.now()}`,7000,{Referer:"https://quote.eastmoney.com/"});const j=parseMaybeJsonp(raw) as any;const rows=Array.isArray(j?.data?.klines)?j.data.klines:[];return rows.map((s:string)=>String(s).split(",")).map((x:string[])=>({date:String(x[0]||"").slice(0,10),close:n(x[2])??0})).filter((x:SectorHistoryPoint)=>x.date&&x.close>0); }catch{return[];}}
function toDailyReturns(points:SectorHistoryPoint[]){const out=new Map<string,number>();for(let i=1;i<points.length;i+=1){const a=points[i-1],b=points[i];if(a.close>0&&b.close>0)out.set(b.date,b.close/a.close-1);}return out;}
function disclosedBySector(report:Awaited<ReturnType<typeof getFundDeepReport>>){const out:Record<string,number>={};for(const x of report.flattened){if(x.children?.length)continue;const hit=SECTOR_RULES.find((s)=>s.keys.some((k)=>k.length>=2&&x.name.includes(k)));if(hit)out[hit.id]=(out[hit.id]??0)+x.effectiveWeightPct;}return out;}
async function fitWindow(fundReturns:Map<string,number>,factorsData:Array<{rule:typeof selected[number];returns:Map<string,number>}>,days:number):Promise<HiddenSectorFit>{const dates=[...fundReturns.keys()].sort();const use=dates.slice(-days);const factors:RegressionFactor[]=factorsData.map((f)=>({id:f.rule.id,name:f.rule.name,returns:use.map((d)=>f.returns.get(d)??0)}));const y=use.map((d)=>fundReturns.get(d)??0);return fitHiddenSectorRegression(y,factors,0.02,650);}

export const getHiddenSectorRegression=createServerFn({method:"POST"}).validator((input:{code:string})=>input).handler(async({data}):Promise<HiddenSectorRegressionReport>=>{
  const code=String(data.code||"").trim();const hit=CACHE.get(code);if(hit&&Date.now()-hit.at<TTL)return hit.report;
  const [fund,deep,...history]=await Promise.all([getFund({data:{code}}),getFundDeepReport({data:{code}}),...selected.map((s)=>getSectorHistory(s.bkCode))]);
  const fundPoints=fund.historyPoints??[];const fundReturns=new Map<string,number>();for(let i=1;i<fundPoints.length;i+=1){const a=fundPoints[i-1],b=fundPoints[i];if(a.nav>0&&b.nav>0)fundReturns.set(b.date,b.nav/a.nav-1);}
  const factorsData=selected.map((rule,i)=>({rule,returns:toDailyReturns(history[i]??[])})).filter((x)=>x.returns.size>=30);const disclosed=disclosedBySector(deep);if(fundReturns.size<45||factorsData.length<4){const report={code,name:fund.name||code,asOf:chinaDate(),sample:fundReturns.size,r2:null,residualPct:null,weights:[],drifts:[],confidence:"unavailable" as const,notes:["历史基金净值或行业指数历史数据不足，无法可靠反推出隐含行业权重。","结果为空不代表没有调仓，只代表当前证据不足。"]};CACHE.set(code,{at:Date.now(),report});return report;}
  const fit90=await fitWindow(fundReturns,factorsData,90);const fit60=await fitWindow(fundReturns,factorsData,60);const fit120=await fitWindow(fundReturns,factorsData,120);const fits=[fit90,fit60,fit120];
  const windows=fits.map((fit)=>({fit,disclosed}));const drifts=persistentDrifts(windows,3);const latest=fit90;const weights=latest.weights.map((w)=>({id:w.id,name:w.name,weightPct:w.weightPct,disclosedPct:disclosed[w.id]??0,deltaPct:w.weightPct-(disclosed[w.id]??0)}));
  const confidence=latest.r2!=null&&latest.r2>=0.55&&latest.sample>=70&&latest.residualPct!=null&&latest.residualPct<=0.35?"high":latest.r2!=null&&latest.r2>=0.35&&latest.sample>=50?"medium":"low";
  const notes:string[]=["模型为非负 Ridge + 权重和≤100%的约束回归，因子使用行业板块日收益。","调仓只在隐含权重与披露权重持续偏离且方向一致时标记为‘疑似调仓’，不会把一次性偏差直接判定为经理换仓。"];
  if(deep.coveragePct<60)notes.push(`底层持仓可识别覆盖约 ${deep.coveragePct.toFixed(1)}%，回归结论需结合未识别部分谨慎解释。`);
  const report={code,name:fund.name||code,asOf:chinaDate(),sample:latest.sample,r2:latest.r2,residualPct:latest.residualPct,weights,drifts,confidence,notes};CACHE.set(code,{at:Date.now(),report});return report;
});
