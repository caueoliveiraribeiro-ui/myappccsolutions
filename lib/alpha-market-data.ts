import {unstable_cache} from "next/cache"
import {createHash} from "node:crypto"
type Data=Record<string,any>
export class MarketProviderError extends Error{
 constructor(message:string,public status=502,public retryAfter=0){super(message)}
}
const pending=new Map<string,Promise<Data>>()
const memory=new Map<string,{data:Data;until:number}>()
let blockedUntil=0
async function fetchProvider(kind:string,value:string){
 if(Date.now()<blockedUntil)throw new MarketProviderError("The stock provider's allowance is temporarily exhausted. Please try later or enter the purchase price manually.",429,Math.ceil((blockedUntil-Date.now())/1000))
 const key=process.env.ALPHA_VANTAGE_API_KEY
 if(!key)throw new MarketProviderError("Stock data is not connected. You can still enter a purchase price manually.",503)
 const parameter=kind==="GLOBAL_QUOTE"?"symbol":"keywords"
 const response=await fetch(`https://www.alphavantage.co/query?function=${kind}&${parameter}=${encodeURIComponent(value)}&apikey=${key}`,{cache:"no-store",signal:AbortSignal.timeout(12000)})
 const data=await response.json().catch(()=>({}))
 if(response.status===429||data.Note||data.Information){
   const daily=/per day|daily|requests a day/i.test(String(data.Note||data.Information||""))
   const retry=Math.max(60,Math.min(86400,Number(response.headers.get("retry-after"))||(daily?3600:60)))
   blockedUntil=Date.now()+retry*1000
   throw new MarketProviderError("The stock provider's allowance is temporarily exhausted. Please try later or enter the purchase price manually.",429,retry)
 }
 if(!response.ok)throw new MarketProviderError("The stock provider is temporarily unavailable. Your saved investments are safe.")
 if(data["Error Message"])throw new MarketProviderError("Ticker not found. Check its exchange suffix or enter the purchase manually.",404)
 if(kind==="GLOBAL_QUOTE"&&!(Number(data["Global Quote"]?.["05. price"])>0))throw new MarketProviderError("Ticker not found. Check its exchange suffix or enter the purchase manually.",404)
 if(kind==="SYMBOL_SEARCH"&&!Array.isArray(data.bestMatches))throw new MarketProviderError("Stock search is temporarily unavailable.")
 return {...data,fetchedAt:new Date().toISOString()}
}
// Only successful responses enter the shared Next.js cache, never provider-limit errors.
const quoteCache=unstable_cache((value:string,_keyId:string)=>fetchProvider("GLOBAL_QUOTE",value),["stock-quotes-v2"],{revalidate:900})
const searchCache=unstable_cache((value:string,_keyId:string)=>fetchProvider("SYMBOL_SEARCH",value),["stock-search-v2"],{revalidate:86400})
export async function alphaMarketData(kind:"GLOBAL_QUOTE"|"SYMBOL_SEARCH",value:string){
 const normalized=value.trim().toUpperCase()
 const keyId=createHash("sha256").update(process.env.ALPHA_VANTAGE_API_KEY||"").digest("hex").slice(0,16)
 const id=kind+":"+normalized+":"+keyId,cached=memory.get(id)
 if(cached&&cached.until>Date.now())return cached.data
 const existing=pending.get(id);if(existing)return existing
 const task=(kind==="GLOBAL_QUOTE"?quoteCache:searchCache)(normalized,keyId).then(data=>{
   if(memory.size>=1000)memory.delete(memory.keys().next().value!)
   memory.set(id,{data,until:Date.now()+(kind==="GLOBAL_QUOTE"?900000:86400000)})
   return data
 }).finally(()=>pending.delete(id))
 pending.set(id,task);return task
}

