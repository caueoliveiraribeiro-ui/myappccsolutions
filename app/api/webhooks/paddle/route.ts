import {NextResponse} from "next/server"
import {verifyPaddleSignature} from "@/lib/paddle"
import {processPaddleEvent} from "@/lib/paddle-webhook"
export const runtime="nodejs"
export async function POST(req:Request){
  const secret=process.env.PADDLE_WEBHOOK_SECRET
  if(!secret||process.env.PADDLE_ENV!=="production")return NextResponse.json({error:"Billing is not configured."},{status:503})
  if(Number(req.headers.get("content-length")||0)>1048576)return new NextResponse(null,{status:413})
  const raw=await req.text()
  if(Buffer.byteLength(raw)>1048576)return new NextResponse(null,{status:413})
  if(!verifyPaddleSignature(raw,req.headers.get("paddle-signature")||"",secret))
    return NextResponse.json({error:"Invalid signature."},{status:401})
  try{return NextResponse.json(await processPaddleEvent(JSON.parse(raw)))}
  catch{
    // Non-2xx makes Paddle retry. Never acknowledge lost database writes as processed.
    console.error("Paddle event processing failed; retry required.")
    return NextResponse.json({error:"Event could not be processed. Please retry."},{status:503})
  }
}
