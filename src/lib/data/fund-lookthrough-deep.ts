import { createServerFn } from "@tanstack/react-start";
import { classifyFund } from "../calc/fund-type-policy";
import { fetchText, n, parseMaybeJsonp } from "./fetch-util";

type Market = "A股" | "港股" | "美国" | "其他海外" | "未识别";
export type DeepSecurityNode = { code:string; name:string; kind:"stock"|"fund"|"etf"|"unknown"; market:Market; depth:number; directWeightPct:number; effectiveWeightPct:number; source:string; children?:DeepSecurityNode[] };
export type DeepExposure = { aSharePct:number; hkPct:number; usPct:number|null; otherOverseasPct:number; unknownPct:number; disclosedPct:number; coveragePct:number; };
export type FundDeepReport = { code:string; name:string; className:string; asOf:string; maxDepth:number; holdings:DeepSecurityNode[]; flattened:DeepSecurityNode[]; exposure:DeepExposure; qdii:boolean; qdiiUsConfidence:"high"|"medium"|"low"|"unavailable"; notes:string[] };

type RawHolding={code:string;name:string;weightPct:number};
const HOLDING_URL="https://fundf10.eastmoney.com/FundArchivesDatas.aspx";
const VALUATION_URL="https://fundcomapi.eastmoney.com/mm/newCore/FundValuationLast";
const FUND_CACHE=new Map<string,{at:number;name:string;type:string}>();
const HOLDING_CACHE=new Map<string,{at:number;rows:RawHolding[]}>();
const TTL=30*60_000;
function html(s:string){return s.replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#39;/g,"'").replace(/\s+/g," ").trim();}
function text(s:string){return html(s.replace(/<[^>]+>/g," "));}
function parseRowsFromHtml(raw:string):RawHolding[]{
  const m=raw.match(/content:\\?"([\s\S]*?)\\?",arryear/i);if(!m)return[];let body=m[1];try{body=JSON.parse(`"${body}"`);}catch{}
  const out:RawHolding[]=[];const seen=new Set<string>();
  for(const tr of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)){
    const row=tr[1];const codes=[...row.matchAll(/(?:quote\.eastmoney\.com\/|[?&](?:code|FCODE)=|(?:sz|sh))([0-9]{6})/gi)].map(x=>x[1]);const fallback=[...row.matchAll(/(?:0|1)\.([0-9]{6})/g)].map(x=>x[1]);const code=[...codes,...fallback].find(x=>/^\d{6}$/.test(x));if(!code||seen.has(code))continue;
    const anchors=[...row.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)].map(x=>text(x[1])).filter(Boolean);const name=anchors.find(x=>!/^\d{6}$/.test(x))||"";
    const cells=[...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(x=>n(text(x[1]))).filter((x):x is number=>x!=null&&x>=0&&x<=100);const weight=cells.length?cells.at(-1)!:null;if(weight==null||weight<=0)continue;
    seen.add(code);out.push({code,name,weightPct:weight});if(out.length>=20)break;
  }return out;
}
async function getHoldings(code:string):Promise<RawHolding[]>{const hit=HOLDING_CACHE.get(code);if(hit&&Date.now()-hit.at<TTL)return hit.rows;try{const raw=await fetchText(`${HOLDING_URL}?type=jjcc&code=${encodeURIComponent(code)}&topline=20&year=&month=&rt=${Date.now()}`,8000,{Referer:"https://fund.eastmoney.com/"});const rows=parseRowsFromHtml(raw);HOLDING_CACHE.set(code,{at:Date.now(),rows});return rows;}catch{return[];}}
async function identifyFund(code:string):Promise<{name:string;type:string}|null>{const cached=FUND_CACHE.get(code);if(cached)return cached;try{const raw=await fetchText(`${VALUATION_URL}?FCODES=${encodeURIComponent(code)}&FIELDS=FCODE,SHORTNAME,FUNDTYPE,FTYPE,GSZZL,GZTIME,GSZ,NAV,PDATE&_=${Date.now()}`,5000,{Referer:"https://fund.eastmoney.com/"});const j=parseMaybeJsonp(raw) as any;const row=Array.isArray(j?.Data)?j.Data.find((x:any)=>String(x.FCODE??x.fundcode??x.CODE??"").trim()===code):null;if(!row)return null;const value={name:String(row.SHORTNAME??row.name??code).trim(),type:String(row.FUNDTYPE??row.fundtype??row.FTYPE??row.type??"").trim()};FUND_CACHE.set(code,value);return value;}catch{return null;}}
function classifyMarket(name:string,kind:string,rootClass:string):Market{const s=`${name} ${kind}`.toLowerCase();if(/纳斯达克|标普|美股|美国|us\b|nasdaq|s&p|道琼斯|苹果|微软|英伟达|亚马逊|谷歌|meta|特斯拉|博通/.test(s))return"美国";if(/港股|恒生|hk\b|香港/.test(s))return"港股";if(rootClass==="qdii"&&/全球|海外|国际|日本|欧洲|德国|印度/.test(s))return"其他海外";if(/基金|etf|股票|a股|沪深|科创|创业板|中证|上证|深证|军工|半导体|白酒|医药|新能源|算力|通信|机器人/.test(s))return"A股";return"未识别";}
async function buildNode(h:RawHolding,depth:number,parentWeight:number,rootClass:string,path:Set<string>):Promise<DeepSecurityNode>{
  const info=await identifyFund(h.code);const isFund=!!info;const actualKind:"fund"|"etf"|"stock"=isFund?(/ETF|LOF/i.test(`${info!.name} ${info!.type}`)?"etf":"fund"):"stock";const direct=h.weightPct;const effective=parentWeight*direct/100;const base:DeepSecurityNode={code:h.code,name:h.name||info?.name||h.code,kind:actualKind,market:classifyMarket(h.name||info?.name||h.code,info?.type||"",rootClass),depth,directWeightPct:direct,effectiveWeightPct:effective,source:"东方财富基金持仓披露"};
  if(!isFund||depth>=2||path.has(h.code))return base;const nextPath=new Set(path);nextPath.add(h.code);const childRows=await getHoldings(h.code);if(!childRows.length)return base;const children=await Promise.all(childRows.slice(0,12).map((row)=>buildNode(row,depth+1,effective,rootClass,nextPath)));base.children=children;const derivedMarket=children.find((x)=>x.market!=="未识别"&&x.effectiveWeightPct>0.5)?.market;if(derivedMarket)base.market=derivedMarket;return base;
}
function flatten(nodes:DeepSecurityNode[]):DeepSecurityNode[]{const out:DeepSecurityNode[]=[];const walk=(x:DeepSecurityNode)=>{out.push(x);for(const c of x.children??[])walk(c);};nodes.forEach(walk);return out;}
function chinaDate(){const d=new Date(Date.now()+8*60*60*1000);return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;}

export const getFundDeepReport=createServerFn({method:"POST"}).validator((input:{code:string})=>input).handler(async({data}):Promise<FundDeepReport>=>{
  const code=String(data.code||"").trim();const root=await identifyFund(code);const name=root?.name||code;const className=classifyFund(root?.type||"",name);const rows=await getHoldings(code);
  if(!rows.length)return {code,name,className,asOf:chinaDate(),maxDepth:0,holdings:[],flattened:[],exposure:{aSharePct:0,hkPct:0,usPct:className==="qdii"?null:0,otherOverseasPct:0,unknownPct:100,disclosedPct:0,coveragePct:0},qdii:className==="qdii",qdiiUsConfidence:"unavailable",notes:["暂无可靠的两层持仓披露，未猜测底层资产。"]};
  const holdings=await Promise.all(rows.slice(0,15).map((row)=>buildNode(row,1,100,className,new Set([code]))));const flat=flatten(holdings);const leaves=flat.filter((x)=>!x.children?.length);const exp={a:0,h:0,u:0,o:0,known:0};
  for(const x of leaves){if(x.market==="A股")exp.a+=x.effectiveWeightPct;else if(x.market==="港股")exp.h+=x.effectiveWeightPct;else if(x.market==="美国")exp.u+=x.effectiveWeightPct;else if(x.market==="其他海外")exp.o+=x.effectiveWeightPct;if(x.market!=="未识别")exp.known+=x.effectiveWeightPct;}
  const us=className==="qdii"?(exp.u>0?exp.u:null):exp.u;const qdiiUsConfidence=className!=="qdii"?"unavailable":us==null?"unavailable":us>=20?"high":"medium";const notes:string[]=[];
  if(className==="qdii")notes.push(us==null?"QDII 已识别，但当前披露中没有足够可确认的美国资产标签，因此不估算含美量。":`QDII 含美量按两层披露中可确认的美国资产计算，覆盖 ${exp.known.toFixed(1)}%。`);notes.push("基金→基金→底层证券最多穿透两层；缺失数据保持未知，不用行业名称硬猜。");
  return {code,name,className,asOf:chinaDate(),maxDepth:Math.max(1,...flat.map(x=>x.depth)),holdings,flattened:flat,exposure:{aSharePct:exp.a,hkPct:exp.h,usPct:us,otherOverseasPct:exp.o,unknownPct:Math.max(0,100-exp.known),disclosedPct:rows.reduce((s,x)=>s+x.weightPct,0),coveragePct:exp.known},qdii:className==="qdii",qdiiUsConfidence,notes};
});
