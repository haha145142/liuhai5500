import { sharedCacheDelete, sharedCacheGet, sharedCacheSet } from "../../src/lib/data/shared-cache";

type Response={status(code:number):Response;json(value:unknown):Response};
type StoredSubscription={endpoint:string;keys:{p256dh:string;auth:string};createdAt:number;updatedAt:number};
const KEY="fund-ai-pro:push:subscriptions";const TTL=180*24*60*60_000;
function valid(value:any):value is StoredSubscription{return !!value&&typeof value.endpoint==="string"&&value.endpoint.startsWith("https://")&&value.keys&&typeof value.keys.p256dh==="string"&&typeof value.keys.auth==="string";}
async function read(){const hit=await sharedCacheGet<StoredSubscription[]>(KEY);return Array.isArray(hit?.value)?hit!.value.filter(valid).slice(0,100):[];}
export default async function handler(req:Request,res:Response){if(req.method!=="POST"&&req.method!=="DELETE")return res.status(405).json({ok:false,error:"method-not-allowed"});
  try{const body=typeof (req as any).body === "object" ? (req as any).body : await (req as any).json?.();const endpoint=String(body?.endpoint||"");const subscriptions=await read();
    if(req.method==="DELETE"){const next=subscriptions.filter((x)=>x.endpoint!==endpoint);await sharedCacheSet(KEY,next,TTL);return res.status(200).json({ok:true,count:next.length});}
    if(!valid(body))return res.status(400).json({ok:false,error:"invalid-subscription"});const now=Date.now();const next=[...subscriptions.filter((x)=>x.endpoint!==endpoint),{endpoint,keys:body.keys,createdAt:subscriptions.find((x)=>x.endpoint===endpoint)?.createdAt||now,updatedAt:now}].slice(-100);const saved=await sharedCacheSet(KEY,next,TTL);return res.status(saved?200:503).json({ok:saved,count:next.length});
  }catch(error){return res.status(500).json({ok:false,error:error instanceof Error?error.message:"push-subscription-failed"});}}
