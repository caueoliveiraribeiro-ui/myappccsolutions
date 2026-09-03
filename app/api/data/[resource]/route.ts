import {NextResponse} from "next/server"
import {cookies} from "next/headers"
import {getSession} from "@/lib/auth"
import {db,hasDatabase} from "@/lib/supabase"
import {accountAccess,upgradeResponse,planWriteError} from "@/lib/plan-access"
import {featureForResource} from "@/lib/plan-features"
const allowed=new Set(["leads","tasks","assets","projects","activities","clients","expenses","grocery_items","portfolios","holdings","payment_records"])
type U={id:string;email:string}
type Context={params:Promise<{resource:string}>}
function cleanFields(input:Record<string,unknown>){const out={...input};const dates=new Set(["due_date","deadline","payment_date","received_at","charge_date","last_call_date","next_follow_up_date","next_follow_up","expense_date","purchased_at","start_time"]);const numbers=new Set(["amount","budget","cost","estimated_value","service_amount","lifetime_value","quantity","estimated_cost","actual_cost","buy_price","current_price"]);for(const [key,value] of Object.entries(out)){if(value===""&&dates.has(key))out[key]=null;if(numbers.has(key)&&value==="")out[key]=0;if((key==="currency"||key==="quote_currency")&&typeof value==="string")out[key]=value.trim().toUpperCase()}return out}

async function auth(){const token=(await cookies()).get("orbit_session")?.value;return token?await getSession(token) as U|null:null}
async function owners(u:U){const memberships=await db(`workspace_members?member_user_id=eq.${u.id}&select=owner_user_id,permission`).catch(()=>[]);return [{owner_user_id:u.id,permission:"editor"},...memberships]}
async function permitted(id:string,resource:string,row:Record<string,any>){return (await accountAccess(id)).features.includes(featureForResource(resource,row))}
async function target(resource:string,id:unknown,u:U){
 if(typeof id!=="string"||!/^[0-9a-f-]{36}$/i.test(id))return null
 const memberships=await owners(u)
 const rows=await db(`${resource}?id=eq.${id}&user_id=in.(${memberships.map((m:any)=>m.owner_user_id).join(",")})&select=*&limit=1`)
 const row=rows?.[0]
 return row&&memberships.some((m:any)=>m.owner_user_id===row.user_id&&m.permission==="editor")?row:null
}
async function validLinks(resource:string,row:Record<string,any>,changed?:Record<string,any>){
 const links:Record<string,string>={portfolio_id:"portfolios",lead_id:"leads",source_lead_id:"leads",source_client_id:"clients",billing_client_id:"clients",source_project_id:"projects"}
 for(const [key,table] of Object.entries(links)){
  if(!row[key]||(changed&&!Object.prototype.hasOwnProperty.call(changed,key)))continue
  const rows=await db(`${table}?id=eq.${encodeURIComponent(String(row[key]))}&user_id=eq.${row.user_id}&select=*&limit=1`)
  if(!rows?.[0])return false
  if(key==="portfolio_id"&&String(rows[0].portfolio_type).toLowerCase()!==String(row.asset_type).toLowerCase())return false
 }
 return true
}
function failure(e:unknown){return planWriteError(e)||NextResponse.json({error:"We could not save this change. Your previous data is safe."},{status:500})}
export async function GET(_:Request,{params}:Context){
 const u=await auth();if(!u)return NextResponse.json({error:"Please sign in again."},{status:401})
 const {resource}=await params;if(!allowed.has(resource))return NextResponse.json({error:"Section unavailable."},{status:404})
 if(!hasDatabase())return NextResponse.json({error:"Database unavailable."},{status:503})
 try{
  const access=await accountAccess(u.id),typed=["holdings","assets","portfolios"].includes(resource)
  if(!(typed?access.features.includes("stocks"):resource==="tasks"?(access.features.includes("tasks")||access.features.includes("focus")):access.features.includes(featureForResource(resource))))return upgradeResponse()
  const items=[]
  for(const m of await owners(u)){
   const ownerAccess=await accountAccess(m.owner_user_id)
   if(!ownerAccess.features.includes(typed?"stocks":resource==="tasks"?"focus":featureForResource(resource)))continue
   let filter=""
   if(typed&&(!access.features.includes("crypto")||!ownerAccess.features.includes("crypto")))filter=`&${resource==="portfolios"?"portfolio_type":"asset_type"}=eq.Stock`
   if(resource==="tasks"&&(!access.features.includes("tasks")||!ownerAccess.features.includes("tasks")))filter="&kind=eq.Focus"
   items.push(...await db(`${resource}?user_id=eq.${m.owner_user_id}${filter}&select=*&order=created_at.desc`))
  }
  return NextResponse.json({configured:true,items})
 }catch{return NextResponse.json({error:"We could not load this information."},{status:503})}
}
export async function POST(request:Request,{params}:Context){
 const u=await auth();if(!u)return NextResponse.json({error:"Please sign in again."},{status:401})
 const {resource}=await params;if(!allowed.has(resource))return NextResponse.json({error:"Section unavailable."},{status:404})
 try{
  const input=await request.json();if(!input||Array.isArray(input)||typeof input!=="object")return NextResponse.json({error:"Invalid record."},{status:400})
  const {id,user_id,...fields}=input,row:Record<string,any>={...cleanFields(fields),user_id:u.id}
  if(!await permitted(u.id,resource,row))return upgradeResponse()
  if(["assets","holdings","portfolios"].includes(resource)&&!["Stock","Crypto"].includes(String(row[resource==="portfolios"?"portfolio_type":"asset_type"]||"Stock")))return NextResponse.json({error:"Choose Stock or Crypto as the asset type."},{status:400})
  if(!await validLinks(resource,row))return NextResponse.json({error:"Choose related records from the same workspace and asset type."},{status:400})
  return NextResponse.json({items:await db(resource,{method:"POST",body:JSON.stringify(row)})})
 }catch(e){return failure(e)}
}
export async function PATCH(request:Request,{params}:Context){
 const u=await auth();if(!u)return NextResponse.json({error:"Please sign in again."},{status:401})
 const {resource}=await params;if(!allowed.has(resource))return NextResponse.json({error:"Section unavailable."},{status:404})
 try{
  const {id,user_id,...changes}=await request.json(),current=await target(resource,id,u)
  if(!current)return NextResponse.json({error:"You cannot edit this record."},{status:403})
  const row={...current,...cleanFields(changes)}
  for(const key of ["asset_type","portfolio_type"])if(current[key]&&row[key]!==current[key])return NextResponse.json({error:"An asset's type cannot be changed."},{status:400})
  if(!await permitted(u.id,resource,current)||!await permitted(u.id,resource,row)||!await permitted(current.user_id,resource,row))return upgradeResponse()
  if(!await validLinks(resource,row,changes))return NextResponse.json({error:"Choose related records from the same workspace and asset type."},{status:400})
  return NextResponse.json({items:await db(`${resource}?id=eq.${encodeURIComponent(id)}&user_id=eq.${current.user_id}`,{method:"PATCH",body:JSON.stringify({...cleanFields(changes),updated_at:new Date().toISOString()})})})
 }catch(e){return failure(e)}
}
export async function DELETE(request:Request,{params}:Context){
 const u=await auth();if(!u)return NextResponse.json({error:"Please sign in again."},{status:401})
 const {resource}=await params;if(!allowed.has(resource))return NextResponse.json({error:"Section unavailable."},{status:404})
 try{
  const {id}=await request.json(),row=await target(resource,id,u)
  if(!row)return NextResponse.json({error:"You cannot delete this record."},{status:403})
  if(!await permitted(u.id,resource,row)||!await permitted(row.user_id,resource,row))return upgradeResponse()
  await db(`${resource}?id=eq.${encodeURIComponent(id)}&user_id=eq.${row.user_id}`,{method:"DELETE"})
  return NextResponse.json({ok:true})
 }catch(e){return failure(e)}
}
