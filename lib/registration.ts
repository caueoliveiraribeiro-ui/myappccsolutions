import {createHash,createHmac,randomBytes} from "node:crypto"
import {db} from "@/lib/supabase"
import {hashUserPassword} from "@/lib/auth"
export const APP_ORIGIN="https://orbit-lm.com"
export const genericRegistrationMessage="If this email can be registered, a verification link is on its way. Check your inbox and spam folder. Already registered? Sign in instead."
export function tokenHash(value:string){return createHash("sha256").update(value).digest("hex")}
export async function requestRegistration(request:Request){
 if(request.headers.get("origin")!==APP_ORIGIN&&request.headers.get("origin")!==new URL(request.url).origin)throw Error("ORIGIN")
 const key=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM_EMAIL,secret=process.env.SESSION_SECRET;
 if(!key||!from||!secret||secret.length<32)throw Error("UNAVAILABLE")
 const raw=await request.text();if(raw.length>8192)throw Error("INPUT");const body=JSON.parse(raw);
 const email=String(body.email||"").trim().toLowerCase(),name=String(body.name||"").trim(),password=body.password;
 if(!name||name.length>80||email.length>254||!/^\S+@\S+\.\S+$/.test(email)||typeof password!=="string"||password.length<12||password.length>128)throw Error("INPUT")
 if(body.website)return;
 const token=randomBytes(32).toString("hex"),hash=tokenHash(token),ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown",ipHash=createHmac("sha256",secret).update(ip).digest("hex"),p=hashUserPassword(password);
 const allowed=await db("rpc/orbit_registration_request",{method:"POST",body:JSON.stringify({p_email:email,p_name:name,p_password_salt:p.salt,p_password_hash:p.hash,p_token_hash:hash,p_ip_hash:ipHash})});
 if(!allowed)return;
 const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},signal:AbortSignal.timeout(15000),body:JSON.stringify({from,to:[email],subject:"Verify your email for Orbit LM",text:`Confirm your email to create your Orbit LM account:\n\n${APP_ORIGIN}/api/auth/verify?token=${token}\n\nThis link expires in 30 minutes. Your new account starts without a paid plan. If you did not request this, ignore this email.`})});
 if(!response.ok){await db(`orbit_registration_pending?token_hash=eq.${hash}`,{method:"DELETE"}).catch(()=>{});throw Error("UNAVAILABLE")}
}
