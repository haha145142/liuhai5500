import { getFund, getPrewarmFundCodes } from "../../src/lib/data/server";
import { sharedCacheGet, sharedCacheSet } from "../../src/lib/data/shared-cache";
import { sendWebPush } from "../../src/lib/push/web-push";

type Response={status(code:number):Response;json(value:unknown):Response};
type StoredSubscription={endpoint:string;keys:{p256dh:string;auth:string};createdAt:number;updatedAt:number};
const SUB_KEY="fund-ai-pro:push:subscriptions";const SUB_TTL=180*24*60*60_000;
function chinaDate(){const d=new Date(Date.now()+8*60*60*1000);return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;}
function auth(req:Request){const secret=String(process.env.CRON_SECRET||"").trim();if(!secret)return true;return req.headers.get("authorization")===`Bearer ${secret}`;}
export default async function handler(req:Request,res:Response){if(req.method!=="GET"&&req.method!=="POST")return res.status(405).json({ok:false,error:"method-not-allowed"});if(!auth(req))return res.status(401).json({ok:false,error:"unauthorized"});
  const configured=String(process.env.VAPID_PUBLIC_KEY||"").trim()&&String(process.env.VAPID_PRIVATE_KEY||"").trim();if(!configured)return res.status(200).json({ok:true,skipped:true,reason:"vapid-not-configured"});
  const hit=await sharedCacheGet<StoredSubscription[]>(SUB_KEY);const subscriptions=Array.isArray(hit?.value)?hit!.value:[];if(!subscriptions.length)return res.status(200).json({ok:true,skipped:true,reason:"no-subscriptions"});
  const codes=await getPrewarmFundCodes();if(!codes.length)return res.status(200).json({ok:true,skipped:true,reason:"no-fund-codes"});
  const date=chinaDate();const sent:string[]=[];const failed:string[]=[];const expired:string[]=[];
  for(const code of codes.slice(0,200)){
    let quote;try{quote=await getFund({data:{code}});}catch{continue;}
    const official=quote.officialNavPublished===true&&String(quote.navDate||"").slice(0,10)===date;
    const alerts:Array<{key:string;title:string;body:string;url:string}> = [];
    if(official&&quote.nav!=null)alerts.push({key:`official:${date}:${code}`,title:`${quote.name||code} 官方净值已更新`,body:`今日官方净值 ${quote.nav.toFixed(4)} · ${quote.dayPct==null?"日涨跌暂无":`${quote.dayPct>=0?"+":""}${quote.dayPct.toFixed(2)}%`}`,url:"/portfolio"});
    if(!official&&quote.valuationStatus==="estimate"&&quote.dayPct!=null&&Math.abs(quote.dayPct)>=3)alerts.push({key:`move:${date}:${code}:${quote.dayPct>0?"up":"down"}`,title:`${quote.name||code} 波动提醒`,body:`盘中估算 ${quote.dayPct>=0?"+":""}${quote.dayPct.toFixed(2)}%，已达到 ±3% 提醒阈值。`,url:"/portfolio"});
    for(const alert of alerts){const dedupe=await sharedCacheGet<boolean>(`fund-ai-pro:push:sent:${alert.key}`);if(dedupe?.value===true)continue;for(const sub of subscriptions){try{await sendWebPush(sub,{title:alert.title,body:alert.body,icon:"/icon-192.png",badge:"/icon-192.png",data:{url:alert.url}});sent.push(`${code}:${alert.key}`);}catch(error){const status=(error as Error&{status?:number}).status;if(status===404||status===410)expired.push(sub.endpoint);else failed.push(`${code}:${alert.key}`);}}await sharedCacheSet(`fund-ai-pro:push:sent:${alert.key}`,true,36*60*60_000);}
  }
  if(expired.length){const next=subscriptions.filter((s)=>!expired.includes(s.endpoint));await sharedCacheSet(SUB_KEY,next,SUB_TTL);}
  return res.status(200).json({ok:true,subscriptions:subscriptions.length,sent:sent.length,failed:failed.length,expired:expired.length,date});
}
