import { sharedCacheGet } from "../../src/lib/data/shared-cache";
import { getVapidPublicKey, sendWebPush } from "../../src/lib/push/web-push";
type Response={status(code:number):Response;json(value:unknown):Response};
type StoredSubscription={endpoint:string;keys:{p256dh:string;auth:string}};
const KEY="fund-ai-pro:push:subscriptions";
function authorized(req:Request){const secret=String(process.env.CRON_SECRET||"").trim();return !secret||req.headers.get("authorization")===`Bearer ${secret}`;}
export default async function handler(req:Request,res:Response){if(req.method!=="POST"&&req.method!=="GET")return res.status(405).json({ok:false,error:"method-not-allowed"});if(!authorized(req))return res.status(401).json({ok:false,error:"unauthorized"});try{getVapidPublicKey();}catch(error){return res.status(503).json({ok:false,error:error instanceof Error?error.message:"vapid-not-configured"});}const hit=await sharedCacheGet<StoredSubscription[]>(KEY);const subs=Array.isArray(hit?.value)?hit!.value:[];if(!subs.length)return res.status(404).json({ok:false,error:"no-subscriptions"});let sent=0;let failed=0;for(const sub of subs.slice(0,100)){try{await sendWebPush(sub,{title:"Fund AI Pro",body:"系统 Push 测试成功。以后官方净值确认、波动提醒可通过系统通知送达。",icon:"/icon-192.png",badge:"/icon-192.png",data:{url:"/portfolio"}});sent+=1;}catch{failed+=1;}}return res.status(200).json({ok:sent>0,sent,failed});}
