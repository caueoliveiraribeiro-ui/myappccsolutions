import {createHmac,timingSafeEqual} from "node:crypto"
export const ORBIT_ORIGIN="https://www.orbit-lm.com"
export function billingReady(){
  return process.env.PADDLE_CHECKOUT_ENABLED==="true" &&
    process.env.PADDLE_ENV==="production" &&
    Boolean(process.env.PADDLE_API_KEY&&process.env.PADDLE_WEBHOOK_SECRET&&process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.startsWith("live_"))
}
export async function paddleApi(path:string,body?:unknown){
  if(process.env.PADDLE_ENV!=="production"||!process.env.PADDLE_API_KEY)throw Error("BILLING_NOT_CONFIGURED")
  const r=await fetch("https://api.paddle.com"+path,{
    method:body===undefined?"GET":"POST",
    headers:{Authorization:"Bearer "+process.env.PADDLE_API_KEY,"Content-Type":"application/json","Paddle-Version":"1"},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),cache:"no-store",signal:AbortSignal.timeout(12000)
  })
  if(!r.ok){
    const detail=await r.text().catch(()=>"")
    console.error("PADDLE_API_ERROR",path,r.status,detail)
    throw Error("PADDLE_REQUEST_FAILED")
  }
  return (await r.json()).data
}
// Verify the unmodified request body; reject old or future signatures and compare in constant time.
export function verifyPaddleSignature(raw:string,header:string,secret:string,now=Date.now()){
  const fields=header.split(";").map(x=>x.trim().split("="))
  const timestamps=fields.filter(([k])=>k==="ts"),hashes=fields.filter(([k])=>k==="h1").map(([,v])=>v)
  if(timestamps.length!==1||!/^\d+$/.test(timestamps[0][1]||""))return false
  const ts=timestamps[0][1]
  if(Math.abs(now/1000-Number(ts))>5)return false
  const expected=createHmac("sha256",secret).update(ts+":"+raw).digest()
  return hashes.some(h=>/^[a-f0-9]{64}$/i.test(h||"")&&timingSafeEqual(expected,Buffer.from(h,"hex")))
}
