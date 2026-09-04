import {db} from "@/lib/supabase"
import {hashUserPassword,verifyUserPassword} from "@/lib/auth"

export const APP_ORIGIN="https://orbit-lm.com"
export const genericRegistrationMessage="Account created. You can sign in now."

export async function requestRegistration(request:Request){
 if(request.headers.get("origin")!==APP_ORIGIN&&request.headers.get("origin")!==new URL(request.url).origin)throw Error("ORIGIN")

 const raw=await request.text()
 if(raw.length>8192)throw Error("INPUT")
 const body=JSON.parse(raw)

 const email=String(body.email||"").trim().toLowerCase()
 const name=String(body.name||"").trim()
 const password=body.password

 if(!name||name.length>80||email.length>254||!/^\S+@\S+\.\S+$/.test(email)||typeof password!=="string"||password.length<12||password.length>128)throw Error("INPUT")
 if(body.website)return

 const existing=await db(`app_users?email=eq.${encodeURIComponent(email)}&select=id&limit=1`)
 if(existing?.length)throw Error("ACCOUNT_EXISTS")

 const p=hashUserPassword(password)

 try{
  await db("app_users",{
   method:"POST",
   body:JSON.stringify({name,email,password_salt:p.salt,password_hash:p.hash})
  })
 }catch(error){
  const message=error instanceof Error?error.message:""
  if(message.includes("duplicate key")||message.includes("23505"))throw Error("ACCOUNT_EXISTS")
  throw error
 }

 const users=await db(`app_users?email=eq.${encodeURIComponent(email)}&select=id,password_salt,password_hash&limit=1`)
 const user=users?.[0]
 if(!user||!verifyUserPassword(password,user.password_salt,user.password_hash))throw Error("PASSWORD_STORE")
}
