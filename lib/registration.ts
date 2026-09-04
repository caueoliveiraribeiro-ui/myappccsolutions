import {createHmac,randomBytes} from "node:crypto"
import {db} from "@/lib/supabase"
import {hashUserPassword,verifyUserPassword} from "@/lib/auth"
export const APP_ORIGIN="https://orbit-lm.com"
export const genericRegistrationMessage="Account created. You can sign in now."
export async function requestRegistration(request:Request){
 if(request.headers.get("origin")!==APP_ORIGIN&&request.headers.get("origin")!==new URL(request.url).origin)throw Error("ORIGIN")
 const secret=process.env.SESSION_SECRET;
 if(!secret||secret.length<32)throw Error("UNAVAILABLE")
 const raw=await request.text();if(raw.length>8192)throw Error("INPUT");const body=JSON.parse(raw);
 const email=String(body.email||"").trim().toLowerCase(),name=String(body.name||"").trim(),password=body.password;
 if(!name||name.length>80||email.length>254||!/^\S+@\S+\.\S+$/.test(email)||typeof password!=="string"||password.length<12||password.length>128)throw Error("INPUT")
 if(body.website)return;
 const existing=await db(`app_users?email=eq.${encodeURIComponent(email)}&select=id&limit=1`)
 if(existing?.length)throw Error("ACCOUNT_EXISTS")
 const token=randomBytes(32).toString("hex"),hash=createHmac("sha256",secret).update(token).digest("hex"),ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown",ipHash=createHmac("sha256",secret).update(ip).digest("hex"),p=hashUserPassword(password);
 const allowed=await db("rpc/orbit_registration_request",{method:"POST",body:JSON.stringify({p_email:email,p_name:name,p_password_salt:p.salt,p_password_hash:p.hash,p_token_hash:hash,p_ip_hash:ipHash})});
 if(!allowed)throw Error("RATE_LIMIT")
 const confirmed=await db("rpc/orbit_registration_confirm",{method:"POST",body:JSON.stringify({p_token_hash:hash})});
 if(!confirmed)throw Error("UNAVAILABLE")
 const users=await db(`app_users?email=eq.${encodeURIComponent(email)}&select=id,password_salt,password_hash&limit=1`),user=users?.[0]
 if(!user||!verifyUserPassword(password,user.password_salt,user.password_hash))throw Error("PASSWORD_STORE")
}
