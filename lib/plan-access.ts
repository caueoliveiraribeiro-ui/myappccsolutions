import { db } from "@/lib/supabase"
import { featuresFor, limitsFor, type Plan } from "@/lib/plan-features"
import { NextResponse } from "next/server"
import {cookies} from "next/headers"
import {getSession} from "@/lib/auth"
// Verified existing owner identities. Never infer owner rights from editable profile fields.
export const ownerAccountIds = new Set(["00000000-0000-4000-8000-000000000001","c38a52ed-766f-47b1-abbd-bc8e152dcaa9"])
export type Access = {plan:Plan;features:readonly string[];status:string;accessUntil?:string|null;limits?:ReturnType<typeof limitsFor>}
export async function accountAccess(id:string):Promise<Access> {
  if(ownerAccountIds.has(id))return {plan:"owner",features:featuresFor("owner"),status:"active",accessUntil:null,limits:limitsFor("owner")}
  try {
    const rows=await db(`account_subscriptions?user_id=eq.${encodeURIComponent(id)}&select=plan,status,access_until&limit=1`)
    const row=rows?.[0]
    const valid=row&&["personal","small_business","big_business"].includes(row.plan)&&row.status==="active"&&row.access_until&&new Date(row.access_until).getTime()>Date.now()
    return valid?{plan:row.plan,features:featuresFor(row.plan),status:"active",accessUntil:row.access_until,limits:limitsFor(row.plan)}:{plan:"none",features:[],status:row?.status==="active"?"expired":row?.status||"unassigned",accessUntil:row?.access_until||null,limits:limitsFor("none")}
  } catch { return {plan:"none",features:[],status:"unavailable"} }
}
export const upgradeResponse=()=>NextResponse.json({error:"Upgrade your plan to access this feature.",code:"PLAN_REQUIRED"},{status:403})
export async function guardFeature(id:string,feature:string){const a=await accountAccess(id);return a.features.includes(feature)?null:upgradeResponse()}
export async function requestFeature(feature:string){
  const token=(await cookies()).get("orbit_session")?.value,user=token?await getSession(token):null
  if(!user)return NextResponse.json({error:"Please sign in again."},{status:401})
  return guardFeature(user.id,feature)
}
export function planWriteError(error:unknown){
  const message=error instanceof Error?error.message:String(error)
  if(message.includes("ORBIT_PLAN_REQUIRED"))return upgradeResponse()
  if(message.includes("ORBIT_QUOTA_"))return NextResponse.json({error:"Your plan's client or lead limit has been reached. Archive eligible leads, remove an unused record, or upgrade your plan.",code:"PLAN_LIMIT"},{status:409})
  return null
}
