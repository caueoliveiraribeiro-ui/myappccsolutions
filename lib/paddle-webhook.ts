import {db} from "@/lib/supabase"
import {paddleApi} from "@/lib/paddle"
import {planForPrice} from "@/lib/paddle-plans"
const id=(value:unknown,prefix:string)=>typeof value==="string"&&new RegExp("^"+prefix+"_[a-z0-9]+$").test(value)
function itemPlan(data:any){
  if(data.items?.length!==1||data.items[0].quantity!==1)return null
  return planForPrice(data.items[0].price?.id||data.items[0].price_id||"")
}
export async function processPaddleEvent(event:any){
  if(!id(event.event_id,"evt")||!event.event_type||!Number.isFinite(Date.parse(event.occurred_at)))throw Error("INVALID_EVENT")
  if(!["transaction.completed","adjustment.updated"].includes(event.event_type)&&!event.event_type.startsWith("subscription."))return {ignored:true}
  const observed=new Date().toISOString()
  let transaction:any=null,subscriptionId:string,refund=false
  if(event.event_type==="transaction.completed"){
    if(!id(event.data?.id,"txn"))throw Error("INVALID_TRANSACTION")
    transaction=await paddleApi("/transactions/"+event.data.id)
    if(transaction.status!=="completed")return {ignored:true}
    subscriptionId=transaction.subscription_id
  }else if(event.event_type==="adjustment.updated"){
    if(!id(event.data?.id,"adj"))throw Error("INVALID_ADJUSTMENT")
    const adjustment=await paddleApi("/adjustments/"+event.data.id)
    if(adjustment.status!=="approved"||!["refund","chargeback"].includes(adjustment.action)||adjustment.type!=="full")return {ignored:true}
    if(!id(adjustment.transaction_id,"txn"))throw Error("INVALID_TRANSACTION")
    transaction=await paddleApi("/transactions/"+adjustment.transaction_id)
    subscriptionId=transaction.subscription_id;refund=true
  }else subscriptionId=event.data?.id
  if(!id(subscriptionId,"sub"))return {ignored:true}
  const bindings=await db("orbit_paddle_subscriptions?subscription_id=eq."+subscriptionId+"&select=*")
  let binding=bindings?.[0],checkout:any=null
  if(!binding){
    if(!transaction||refund)return {ignored:true} // Created/activated alone never grants access.
    const intents=await db("orbit_paddle_checkouts?transaction_id=eq."+transaction.id+"&select=*")
    checkout=intents?.[0]
    if(!checkout){
      const intentId=transaction.custom_data?.orbit_checkout_id
      if(typeof intentId==="string"&&/^[a-f0-9-]{36}$/i.test(intentId)){
        const pending=await db("orbit_paddle_checkouts?id=eq."+intentId+"&select=id,transaction_id")
        if(pending?.[0]&&!pending[0].transaction_id)throw Error("RETRY_CHECKOUT_BINDING")
      }
      return {ignored:true} // Purchases outside Orbit cannot claim an arbitrary account.
    }
    binding={user_id:checkout.user_id,customer_id:checkout.customer_id}
  }
  const sub=await paddleApi("/subscriptions/"+subscriptionId)
  const plan=itemPlan(sub)
  if(!plan)return {ignored:true} // Customization / invitation products never become standard plans.
  if(checkout&&checkout.plan!==plan)throw Error("CHECKOUT_PLAN_MISMATCH")
  if(binding.customer_id&&binding.customer_id!==sub.customer_id)throw Error("CUSTOMER_MISMATCH")
  let paidUntil:string|null=null
  if(transaction&&!refund){
    if(itemPlan(transaction)!==plan||transaction.customer_id!==sub.customer_id)throw Error("PAYMENT_PLAN_MISMATCH")
    paidUntil=transaction.billing_period?.ends_at
    if(!paidUntil||!Number.isFinite(Date.parse(paidUntil)))throw Error("MISSING_PAID_PERIOD")
  }
  return db("rpc/orbit_apply_paddle_event",{method:"POST",body:JSON.stringify({
    p_event:event.event_id,p_observed:observed,p_sub:subscriptionId,p_user:binding.user_id,
    p_customer:sub.customer_id,p_plan:plan,p_status:sub.status,
    p_paid_until:paidUntil,p_checkout:checkout?.id||null,p_transaction:transaction?.id||null,p_refund:refund
  })})
}
