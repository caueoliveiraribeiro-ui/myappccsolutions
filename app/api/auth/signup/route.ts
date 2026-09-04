import {NextResponse} from "next/server"
import {requestRegistration,genericRegistrationMessage} from "@/lib/registration"
export async function POST(request:Request){
 try{
  await requestRegistration(request)
  return NextResponse.json({ok:true,message:genericRegistrationMessage})
 }catch(error){
  const reason=error instanceof Error?error.message:""
  if(reason==="ACCOUNT_EXISTS")return NextResponse.json({error:"An Orbit account already exists for this email. Please sign in with the password already set for that account."},{status:409})
  if(reason==="RATE_LIMIT")return NextResponse.json({error:"Too many signup attempts. Please wait and try again later."},{status:429})
  if(reason==="PASSWORD_STORE")return NextResponse.json({error:"The account could not be finalized securely. Please try again."},{status:503})
  if(reason==="INPUT"||error instanceof SyntaxError)return NextResponse.json({error:"Enter your name, a valid email, and a password between 12 and 128 characters."},{status:400})
  if(reason==="ORIGIN")return NextResponse.json({error:"Please create your account from the Orbit website."},{status:403})
  return NextResponse.json({error:"Account creation is temporarily unavailable. Please try again later."},{status:503})
 }
}
