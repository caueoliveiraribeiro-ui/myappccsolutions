import {cookies} from "next/headers"
import {NextResponse} from "next/server"
import {getSession} from "@/lib/auth"
import {ownerAccountIds} from "@/lib/plan-access"
import {db} from "@/lib/supabase"
import {billingReady,ORBIT_ORIGIN,paddleApi} from "@/lib/paddle"
import {isStandardPlan,paddleOffers} from "@/lib/paddle-plans"
export const runtime="nodejs"
export async function POST(req:Request){
  if(req.headers.get("origin")!==ORBIT_ORIGIN)return NextResponse.json({error:"Please start checkout inside Orbit."},{status:403})
  const token=(await cookies()).get("orbit_session")?.value,user=token?await getSession(token):null
  if(!user)return NextResponse.json({error:"Sign in or verify your account before subscribing."},{status:401})
  if(ownerAccountIds.has(user.id))return NextResponse.json({error:"Your owner account already has full access. No subscription is needed."},{status:409})
  if(!billingReady())return NextResponse.json({error:"Subscriptions are not open yet. Your account is safe; no payment has been taken."},{status:503})
  try{
    const body:{plan:unknown}=await req.json()
    if(!isStandardPlan(body.plan))return NextResponse.json({error:"Choose a Personal, Small Business or Big Business plan."},{status:400})
    const offer=paddleOffers[body.plan]
    const price=await paddleApi("/prices/"+offer.priceId)
    if(price.status!=="active"||price.billing_cycle?.interval!=="month"||price.billing_cycle?.frequency!==1||price.trial_period||
       price.unit_price?.currency_code!=="USD"||Number(price.unit_price?.amount)!==Math.round(offer.monthlyUsd*100))
      return NextResponse.json({error:"This offer needs a billing configuration check. No payment has been taken."},{status:503})
    // Atomic account lock prevents concurrent checkout creation / accidental second subscriptions.
    const intent=await db("rpc/orbit_begin_paddle_checkout",{method:"POST",body:JSON.stringify({p_user:user.id,p_plan:body.plan,p_price:offer.priceId})})
    if(intent.transaction_id)return NextResponse.json({transactionId:intent.transaction_id})
    const customers=await paddleApi("/customers?email="+encodeURIComponent(user.email))
    const customer=customers.find((c:{email:string;status:string})=>c.email.toLowerCase()===user.email.toLowerCase()&&c.status==="active")||
      await paddleApi("/customers",{email:user.email})
    await db("orbit_paddle_checkouts?id=eq."+intent.id,{method:"PATCH",body:JSON.stringify({customer_id:customer.id})})
    const txn=await paddleApi("/transactions",{
      items:[{price_id:offer.priceId,quantity:1}],collection_mode:"automatic",customer_id:customer.id,
      custom_data:{orbit_checkout_id:intent.id},
      checkout:{url:ORBIT_ORIGIN+"/subscribe?plan="+body.plan}
    })
    if(!/^txn_[a-z0-9]+$/.test(txn.id))throw Error("INVALID_TRANSACTION")
    // Until this persisted binding succeeds we never expose the checkout to the browser.
    await db("orbit_paddle_checkouts?id=eq."+intent.id,{method:"PATCH",body:JSON.stringify({transaction_id:txn.id})})
    return NextResponse.json({transactionId:txn.id})
  }catch(e){
    const busy=String(e).includes("ORBIT_CHECKOUT_BUSY"),existing=String(e).includes("ORBIT_SUBSCRIPTION_EXISTS")
    return NextResponse.json({error:existing?"You already have a subscription. Manage it before starting another.":busy?"A checkout is already being prepared. Please wait a moment and retry.":"Checkout could not be prepared. Please try again later; do not submit another payment if you already paid."},{status:existing||busy?409:503})
  }
}
