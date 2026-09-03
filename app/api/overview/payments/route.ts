import {NextResponse} from "next/server"
import {cookies} from "next/headers"
import {getSession} from "@/lib/auth"
import {db} from "@/lib/supabase"
import {accountAccess,upgradeResponse} from "@/lib/plan-access"
// Overview is included in every plan. Expose monthly received totals, not ledger identities or notes.
export async function GET(){
 const token=(await cookies()).get("orbit_session")?.value,user=token?await getSession(token):null
 if(!user)return NextResponse.json({error:"Please sign in again."},{status:401})
 if(!(await accountAccess(user.id)).features.includes("overview"))return upgradeResponse()
 try{
  const members=await db(`workspace_members?member_user_id=eq.${user.id}&select=owner_user_id`).catch(()=>[])
  const owners=new Set<string>([user.id,...members.map((m:any)=>m.owner_user_id)])
  const now=new Date(),start=`${now.getFullYear()-1}-${String(now.getMonth()+1).padStart(2,"0")}-01`
  const groups=new Map<string,Record<string,any>>()
  for(const id of owners){
   if(!(await accountAccess(id)).features.includes("overview"))continue
   const rows=await db(`payment_records?user_id=eq.${id}&select=amount,currency,status,received_at,created_at&or=(received_at.gte.${start},created_at.gte.${start})`)
   for(const row of rows){
    if(row.status&&row.status!=="Payment received")continue
    const month=String(row.received_at||row.created_at||"").slice(0,7),currency=row.currency||"USD",key=month+":"+currency
    if(!groups.has(key))groups.set(key,{received_at:month+"-01",currency,status:"Payment received",amount:0,entry_count:0})
    const group=groups.get(key)!;group.amount+=Number(row.amount||0);group.entry_count++
   }
  }
  return NextResponse.json({items:[...groups.values()]})
 }catch{return NextResponse.json({error:"Payment totals are temporarily unavailable."},{status:503})}
}

