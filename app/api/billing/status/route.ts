import {cookies} from "next/headers"
import {NextResponse} from "next/server"
import {getSession} from "@/lib/auth"
import {accountAccess} from "@/lib/plan-access"
export async function GET(){
  const token=(await cookies()).get("orbit_session")?.value,user=token?await getSession(token):null
  if(!user)return NextResponse.json({error:"Please sign in."},{status:401})
  return NextResponse.json({access:await accountAccess(user.id)},{headers:{"Cache-Control":"no-store"}})
}
