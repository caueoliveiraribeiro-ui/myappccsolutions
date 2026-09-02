import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
export const OWNER_ID="00000000-0000-4000-8000-000000000001"
export function checkPassword(password:string){const salt=process.env.ADMIN_PASSWORD_SALT,expected=process.env.ADMIN_PASSWORD_HASH;if(!salt||!expected)return false;const actual=scryptSync(password,salt,64),target=Buffer.from(expected,"hex");return target.length===actual.length&&timingSafeEqual(target,actual)}
export function hashUserPassword(password:string,salt=randomBytes(24).toString("hex")){return{salt,hash:scryptSync(password,salt,64).toString("hex")}}
export function verifyUserPassword(password:string,salt:string,hash:string){const a=scryptSync(password,salt,64),b=Buffer.from(hash,"hex");return a.length===b.length&&timingSafeEqual(a,b)}
export function createSession(email:string,id=OWNER_ID){const expiry=Date.now()+1000*60*60*12,payload=Buffer.from(JSON.stringify({id,email,expiry})).toString("base64url"),signature=createHmac("sha256",secret()).update(payload).digest("base64url");return `${payload}.${signature}`}
export async function getSession(token:string){try{const[payload,signature]=token.split(".");if(!payload||!signature)return null;const expected=createHmac("sha256",secret()).update(payload).digest("base64url"),a=Buffer.from(signature),b=Buffer.from(expected);if(a.length!==b.length||!timingSafeEqual(a,b))return null;const data=JSON.parse(Buffer.from(payload,"base64url").toString());return data.expiry>Date.now()&&data.id&&data.email?data:null}catch{return null}}
export async function verifySession(token:string){return Boolean(await getSession(token))}
function secret(){return process.env.SESSION_SECRET||"development-only-change-before-production"}

