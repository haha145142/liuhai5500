import { getVapidPublicKey } from "../../src/lib/push/web-push";
type Response={status(code:number):Response;json(value:unknown):Response};
export default async function handler(_req:Request,res:Response){try{const key=getVapidPublicKey();return res.status(200).json({ok:true,publicKey:key});}catch(error){return res.status(503).json({ok:false,error:error instanceof Error?error.message:"vapid-not-configured"});}}
