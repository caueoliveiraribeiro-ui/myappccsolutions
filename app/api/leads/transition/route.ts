import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/supabase"
import { accountAccess, planWriteError, upgradeResponse } from "@/lib/plan-access"

export async function POST(request: Request) {
 const user = await getSession((await cookies()).get("orbit_session")?.value || "")
 if (!user) return NextResponse.json({error:"Please sign in again."},{status:401})
 try {
  const {id,changes,clientId}=await request.json()
  const validId=(value:unknown)=>typeof value==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  if((id!=null&&!validId(id)) || (clientId!=null&&!validId(clientId)) || !changes || typeof changes!=="object" || Array.isArray(changes)) return NextResponse.json({error:"Choose a valid lead."},{status:400})
  const memberships=await db(`workspace_members?member_user_id=eq.${user.id}&permission=eq.editor&select=owner_user_id`)
  const owners=[user.id,...memberships.map((x:any)=>x.owner_user_id)]
  const rows=id||clientId ? await db(`${clientId?"clients":"leads"}?id=eq.${clientId||id}&user_id=in.(${owners.join(",")})&select=user_id&limit=1`) : [{user_id:user.id}]
  const owner=rows?.[0]?.user_id
  if(!owner)return NextResponse.json({error:"This lead is not available in your workspace."},{status:403})
  for(const who of [user.id,owner]) { const access=await accountAccess(who);if(!access.features.includes("leads")||!access.features.includes("clients")||!access.features.includes("projects"))return upgradeResponse() }
  const keys=new Set(["company","contact_name","email","phone","address","city","country","service","description","notes","estimated_value","currency","last_call_date","next_follow_up_date","status","archived","directory_hidden"])
  const clean=Object.fromEntries(Object.entries(changes).filter(([k])=>keys.has(k)).map(([k,v])=>[k,(k.endsWith("_date")&&v==="")?null:v]))
  if(clean.status&&!["Registered","New","Contacted","Qualified","Proposal","Client","Won","Lost"].includes(String(clean.status)))return NextResponse.json({error:"Choose a valid pipeline stage."},{status:400})
  if(clientId && !clean.status)return NextResponse.json({error:"Choose a pipeline stage."},{status:400})
  if(!id&&!clientId&&!String(clean.company||"").trim())return NextResponse.json({error:"Enter a company or lead name."},{status:400})
  const result=await db(clientId?"rpc/orbit_reenter_client":"rpc/orbit_transition_lead",{method:"POST",body:JSON.stringify(clientId?{p_owner:owner,p_client:clientId,p_status:clean.status}:{p_owner:owner,p_id:id||null,p_changes:clean})})
  return NextResponse.json(result,{headers:{"Cache-Control":"no-store"}})
 } catch(error){return planWriteError(error)||NextResponse.json({error:"We could not update the flow. No partial changes were saved."},{status:500})}
}
