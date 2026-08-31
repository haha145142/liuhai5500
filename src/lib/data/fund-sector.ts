import { createServerFn } from "@tanstack/react-start";
import { getCalculatedFund } from "./live-valuation";
import { FUND_SECTORS, DEFAULT_FUND_SECTOR_IDS } from "./fund-sectors";
import { fetchText, n, parseMaybeJsonp } from "./fetch-util";

export type FundSectorFundQuote = { code:string; name:string; pct:number|null; nav:number|null; estimate:number|null; time:string|null; date:string|null; validation:"cross_checked"|"single_source"|"unavailable"; source:string };
export type FundSectorQuote = { id:string; name:string; icon:string; pct:number|null; up:number; down:number; flat:number; validCount:number; totalCount:number; leader:FundSectorFundQuote|null; weakest:FundSectorFundQuote|null; funds:FundSectorFundQuote[]; marketDate:string|null; source:string; validation:"cross_checked"|"single_source"|"cached_latest_trading_day"|"unavailable" };
const EM="https://fundcomapi.eastmoney.com/mm/newCore/FundValuationLast";
const TT="https://fundcomapi.tiantianfunds.com/mm/newCore/FundValuationLast";
const FIELDS="FCODE,SHORTNAME,GSZZL,GZTIME,GSZ,NAV,PDATE";
const CACHE_TTL=20_000;
let cache:{key:string;ts:number;data:FundSectorQuote[]}|null=null;
function isWeekend(){const d=new Date(Date.now()+8*60*60*1000);return d.getUTCDay()===0||d.getUTCDay()===6;}
function chunk<T>(arr:T[],size:number){const out:T[][]=[];for(let i=0;i<arr.length;i+=size)out.push(arr.slice(i,i+size));return out;}
function pct(v:unknown){const x=n(v);return x!=null&&Number.isFinite(x)&&Math.abs(x)<=30?x:null;}
function parseRows(payload:unknown){const j=parseMaybeJsonp(String(payload??"")) as any;const rows=j?.Data||j?.data||j?.Datas||j?.data?.list||[];return Array.isArray(rows)?rows:rows&&typeof rows==="object"?Object.values(rows) as Record<string,unknown>[]:[];}
async function fetchProvider(base:string,codes:string[]){try{return parseRows(await fetchText(`${base}?FCODES=${encodeURIComponent(codes.join(","))}&FIELDS=${encodeURIComponent(FIELDS)}&_=${Date.now()}`,9000,{Referer:"https://fund.eastmoney.com/"}));}catch{return[];}}
function pick(row:Record<string,unknown>){return{code:String(row.FCODE??row.fundcode??"").trim(),name:String(row.SHORTNAME??row.name??"").trim(),pct:pct(row.GSZZL??row.gszzl),nav:n(row.NAV??row.dwjz),estimate:n(row.GSZ??row.gsz),time:row.GZTIME??row.gztime?String(row.GZTIME??row.gztime):null,date:row.PDATE??row.jzrq?String(row.PDATE??row.jzrq):null};}
function mergeQuote(primary:ReturnType<typeof pick>|null,secondary:ReturnType<typeof pick>|null,own:Awaited<ReturnType<typeof getCalculatedFund>>|null,code:string,fallbackName:string):FundSectorFundQuote{
 const providerPct=primary?.pct!=null&&secondary?.pct!=null?Math.abs(primary.pct-secondary.pct)<=0.15?primary.pct:null:null;
 const hasProviderConsensus=providerPct!=null;
 const ownPct=own?.estimatePct??own?.dayPct??null;
 const effectivePct=hasProviderConsensus?providerPct:ownPct;
 if(effectivePct!=null||own?.nav!=null||primary?.nav!=null||secondary?.nav!=null){
  const useOwnEstimate=ownPct!=null;
  const validated=hasProviderConsensus||(useOwnEstimate&&((own?.quoteCrossCheckedWeight??0)>0));
  return { code,name:own?.name||primary?.name||secondary?.name||fallbackName,pct:effectivePct,nav:own?.nav??primary?.nav??secondary?.nav??null,estimate:useOwnEstimate?own?.estimate??null:primary?.estimate??secondary?.estimate??null,time:own?.estimateTime??primary?.time??secondary?.time??null,date:own?.navDate??primary?.date??secondary?.date??null,validation:validated?"cross_checked":"single_source",source:hasProviderConsensus?(useOwnEstimate?"Fund AI Pro 自算 + 天天基金 + 东方财富交叉验证":"天天基金 + 东方财富交叉验证"):(useOwnEstimate?"Fund AI Pro 自算穿透估值":"最近官方净值") };
 }
 return {code,name:fallbackName,pct:null,nav:null,estimate:null,time:null,date:null,validation:"unavailable",source:"暂无可靠数据"};
}
async function getOwnQuotes(codes:string[]){const out=new Map<string,Awaited<ReturnType<typeof getCalculatedFund>>>();const queue=codes.slice();const workers=Array.from({length:Math.min(4,Math.max(1,queue.length))},async()=>{while(queue.length){const code=queue.shift();if(!code)return;try{out.set(code,await getCalculatedFund({data:{code}}));}catch{out.set(code,null as any);}}});await Promise.all(workers);return out;}
export const getFundSectorQuotes=createServerFn({method:"POST"}).validator((input:{ids?:string[]})=>input).handler(async({data}):Promise<{rows:FundSectorQuote[];fetchedAt:number;weekend:boolean}>=>{
 const ids=(data.ids?.length?data.ids:DEFAULT_FUND_SECTOR_IDS).filter(id=>FUND_SECTORS.some(s=>s.id===id));const key=ids.join(",");const weekend=isWeekend();const ttl=weekend?24*60*60*1000:CACHE_TTL;if(cache&&cache.key===key&&Date.now()-cache.ts<ttl)return{rows:cache.data,fetchedAt:cache.ts,weekend};
 const sectors=FUND_SECTORS.filter(s=>ids.includes(s.id));const unique=new Map<string,{code:string;name:string}>();for(const sector of sectors)for(const fund of sector.funds)unique.set(fund.code,fund);const codes=[...unique.keys()];
 const [ownMap,providerPairs]=await Promise.all([getOwnQuotes(codes),Promise.all(chunk(codes,40).map(async batch=>({east:await fetchProvider(EM,batch),tt:await fetchProvider(TT,batch)})))]);
 const eastMap=new Map<string,ReturnType<typeof pick>>();const ttMap=new Map<string,ReturnType<typeof pick>>();for(const pair of providerPairs){for(const row of pair.east){const q=pick(row);if(q.code)eastMap.set(q.code,q);}for(const row of pair.tt){const q=pick(row);if(q.code)ttMap.set(q.code,q);}}
 const rows=sectors.map((sector):FundSectorQuote=>{const funds=sector.funds.map(f=>mergeQuote(eastMap.get(f.code)??null,ttMap.get(f.code)??null,ownMap.get(f.code)??null,f.code,f.name));const valid=funds.filter(f=>f.pct!=null);const up=valid.filter(f=>(f.pct as number)>0).length;const down=valid.filter(f=>(f.pct as number)<0).length;const flat=valid.length-up-down;const avg=valid.length?valid.reduce((sum,f)=>sum+(f.pct as number),0)/valid.length:null;const sorted=valid.slice().sort((a,b)=>(b.pct as number)-(a.pct as number));const cross=valid.filter(f=>f.validation==="cross_checked").length;const validation:FundSectorQuote["validation"]=!valid.length?"unavailable":cross>=Math.max(1,Math.ceil(valid.length*0.6))?"cross_checked":"single_source";const dates=valid.map(f=>f.date).filter((v):v is string=>!!v);return{id:sector.id,name:sector.name,icon:sector.icon,pct:avg,up,down,flat,validCount:valid.length,totalCount:sector.funds.length,leader:sorted[0]??null,weakest:sorted.at(-1)??null,funds,marketDate:dates.sort().at(-1)??null,validation,source:validation==="cross_checked"?"自算估值 + 多源交叉验证":validation==="single_source"?"当前/最近有效数据":"暂无可靠数据"};});
 if(rows.some(r=>r.validCount>0))cache={key,ts:Date.now(),data:rows};return{rows,fetchedAt:Date.now(),weekend};
});