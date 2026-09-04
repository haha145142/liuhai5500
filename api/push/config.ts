type Response={status(code:number):Response;json(value:unknown):Response};
export default async function handler(_req:Request,res:Response){const key=String(process.env.VAPID_PUBLIC_KEY||"").trim();return res.status(key?200:503).json({ok:!!key,publicKey:key||null});}
