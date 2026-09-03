import {cookies} from "next/headers"
import {NextResponse} from "next/server"
import {getSession} from "@/lib/auth"
import {db} from "@/lib/supabase"
import {ORBIT_ORIGIN,paddleApi} from "@/lib/paddle"
export async function POST(req:Request){
  if(req.headers.get("origin")!==ORBIT_ORIGIN)return NextResponse.json({error:"Please open billing inside Orbit."},{status:403})
  const token=(await cookies()).get("orbit_session")?.value,user=token?await getSession(token):null
  if(!user)return NextResponse.json({error:"Please sign in."},{status:401})
  try{
    const rows=await db("orbit_paddle_subscriptions?user_id=eq."+encodeURIComponent(user.id)+"&select=customer_id&order=updated_at.desc&limit=1")
    if(!rows?.[0])return NextResponse.json({error:"No Paddle subscription is linked to your account yet."},{status:404})
    const session=await paddleApi("/customers/"+rows[0].customer_id+"/portal-sessions",{})
    const url=new URL(session.urls.general.overview)
    if(url.protocol!=="https:"||url.hostname!=="customer-portal.paddle.com")throw Error("INVALID_PORTAL")
    return NextResponse.json({url:url.href})
  }catch{return NextResponse.json({error:"Billing management is temporarily unavailable. Please try again."},{status:503})}
}
