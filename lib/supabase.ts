const url=()=>process.env.NEXT_PUBLIC_SUPABASE_URL
const key=()=>process.env.SUPABASE_SERVICE_ROLE_KEY
export function hasDatabase(){return Boolean(url()&&key())}
export async function db(resource:string,init:RequestInit={}){if(!hasDatabase())throw new Error("Database is not configured");const response=await fetch(`${url()}/rest/v1/${resource}`,{...init,headers:{apikey:key()!,Authorization:`Bearer ${key()}`,"Content-Type":"application/json",Prefer:"return=representation",...(init.headers||{})},cache:"no-store"});if(!response.ok)throw new Error(await response.text());if(response.status===204)return null;return response.json()}

