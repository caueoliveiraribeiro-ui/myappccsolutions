import {NextResponse} from "next/server"
import {cookies} from "next/headers"
import {getSession} from "@/lib/auth"
import {db} from "@/lib/supabase"
import {validateClientImport,ClientImportRow} from "@/lib/client-import"
export async function POST(request:Request){
 const token=(await cookies()).get("orbit_session")?.value,user=token?await getSession(token):null
 if(!user)return NextResponse.json({error:"Please sign in again."},{status:401})
 try{
  const text=await request.text()
  if(text.length>300000)return NextResponse.json({error:"Import up to 500 clients at a time."},{status:400})
  const body=JSON.parse(text)
  if(!Array.isArray(body.clients)||!body.clients.length||body.clients.length>500)return NextResponse.json({error:"Choose between 1 and 500 clients."},{status:400})
  const clients:ClientImportRow[]=body.clients.map((row:any)=>({name:String(row?.name||"").trim(),email:String(row?.email||"").trim().toLowerCase(),phone:String(row?.phone||"").trim()}))
  if(clients.some(row=>!validateClientImport(row)))return NextResponse.json({error:"Check Name, Email and Phone on each row."},{status:400})
  const items=await db("rpc/orbit_import_clients",{method:"POST",body:JSON.stringify({p_owner:user.id,p_clients:clients})})
  return NextResponse.json({items,imported:items.length,skipped:clients.length-items.length})
 }catch{return NextResponse.json({error:"Import could not finish. Check the sheet and make sure the Orbit payments/import SQL update is installed."},{status:400})}
}

