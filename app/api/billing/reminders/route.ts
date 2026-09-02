import {NextResponse} from "next/server"
import {cookies} from "next/headers"
import {getSession} from "@/lib/auth"
import {db} from "@/lib/supabase"
export async function POST(){
 const token=(await cookies()).get("orbit_session")?.value;
 const user=token?await getSession(token):null;
 if(!user)return NextResponse.json({error:"Please sign in again."},{status:401});
 try{
   const owners=new Set<string>([user.id]);
   const memberships=await db(`workspace_members?member_user_id=eq.${user.id}&permission=eq.editor&select=owner_user_id`).catch(()=>[]);
   for(const membership of memberships)owners.add(membership.owner_user_id);
   for(const owner of owners)await db("rpc/orbit_create_billing_reminders",{method:"POST",body:JSON.stringify({p_owner:owner})});
   return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:"Run the latest billing SQL update, then refresh."},{status:503})}
}
