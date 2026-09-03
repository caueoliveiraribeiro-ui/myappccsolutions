import {NextResponse} from "next/server"
import {cookies} from "next/headers"
import {getSession} from "@/lib/auth"
import {db} from "@/lib/supabase"
import {accountAccess,upgradeResponse} from "@/lib/plan-access"
import {featureForResource} from "@/lib/plan-features"
const sources={payments:"payment_records",expenses:"expenses",groceries:"grocery_items",projects:"projects",leads:"leads",holdings:"holdings",portfolios:"portfolios"} as const
export async function GET(){
 const token=(await cookies()).get("orbit_session")?.value,user=token?await getSession(token):null
 if(!user)return NextResponse.json({error:"Please sign in again before exporting."},{status:401})
 if(!(await accountAccess(user.id)).features.includes("reports"))return upgradeResponse()
 try{
  const memberships=await db(`workspace_members?member_user_id=eq.${user.id}&select=owner_user_id`)
  const owners=[...new Set<string>([user.id,...memberships.map((m:any)=>m.owner_user_id)])]
  const data:Record<string,any[]>={}
  const access=await Promise.all(owners.map(async id=>({id,...await accountAccess(id)})))
  for(const [name,resource] of Object.entries(sources)){
   data[name]=[]
   for(const owner of access){
    if(!owner.features.includes(featureForResource(resource)))continue
    const typed=resource==="holdings"||resource==="portfolios"
    const filter=typed&&!owner.features.includes("crypto")?`&${resource==="portfolios"?"portfolio_type":"asset_type"}=eq.Stock`:""
    for(let offset=0;;offset+=500){
     if(offset>=50000)throw Error("EXPORT_TOO_LARGE")
     const rows=await db(`${resource}?user_id=eq.${owner.id}${filter}&select=*&order=created_at.asc,id.asc&limit=500&offset=${offset}`)
     data[name].push(...rows)
     if(rows.length<500)break
    }
   }
  }
  return NextResponse.json({data},{headers:{"Cache-Control":"private, no-store"}})
 }catch(error){
  return NextResponse.json({error:error instanceof Error&&error.message==="EXPORT_TOO_LARGE"?"This workspace is too large for a single export. Contact the administrator for a bulk report.":"We could not load the complete report data. No partial report was created. Please try again."},{status:503})
 }
}

