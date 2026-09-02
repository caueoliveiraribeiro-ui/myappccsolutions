import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession } from "@/lib/auth"
type Quote={symbol:string;name:string;price:number;change24h:number;currency:string;source:string;originalPrice?:number;originalCurrency?:string;exchangeRate?:number}
const quotes=new Map<string,{until:number;data:Quote}>(),allowed=new Set(["USD","BRL","EUR","GBP","CAD","AUD","JPY","KRW","MXN","CHF"])
async function authorized(){const token=(await cookies()).get("orbit_session")?.value;return Boolean(token&&await verifySession(token))}
async function convert(price:number,from:string,to:string){if(from===to)return{price,rate:1};const r=await fetch(`https://api.frankfurter.dev/v2/rate/${encodeURIComponent(from)}/${encodeURIComponent(to)}`,{next:{revalidate:21600}}),d=await r.json().catch(()=>({}));if(!r.ok||!Number.isFinite(Number(d.rate)))throw Error("Currency conversion is temporarily unavailable. Please try again shortly.");return{price:price*Number(d.rate),rate:Number(d.rate)}}
function stockCurrency(symbol:string){
 const suffixes:Record<string,string>={".SAO":"BRL",".LON":"GBP",".TRT":"CAD",".TOR":"CAD",".AUS":"AUD",".TYO":"JPY",".KSC":"KRW",".MEX":"MXN",".SWX":"CHF",".DEX":"EUR",".FRA":"EUR",".PAR":"EUR",".AMS":"EUR",".MIL":"EUR",".LIS":"EUR",".MAD":"EUR"}
 return Object.entries(suffixes).find(([suffix])=>symbol.endsWith(suffix))?.[1]||"USD"
}
export async function GET(request:Request){
 if(!await authorized())return NextResponse.json({error:"Your session expired. Please sign in again."},{status:401})
 const u=new URL(request.url),type=u.searchParams.get("type"),symbol=(u.searchParams.get("symbol")||"").trim().toUpperCase(),currency=(u.searchParams.get("currency")||"USD").toUpperCase()
 if(!symbol||!["stock","crypto"].includes(type||""))return NextResponse.json({error:"Enter a stock or crypto symbol."},{status:400})
 if(!allowed.has(currency))return NextResponse.json({error:"Choose a supported currency in Settings."},{status:400})
 const cacheKey=`${type}:${symbol}:${currency}`,cached=quotes.get(cacheKey);if(cached&&cached.until>Date.now())return NextResponse.json(cached.data)
 try{
  let base:Quote
  if(type==="stock"){
   const key=process.env.ALPHA_VANTAGE_API_KEY;if(!key)return NextResponse.json({error:"Live stock prices are not connected. You can still enter the ticker and purchase price manually."},{status:503})
   const r=await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${key}`,{cache:"no-store"}),d=await r.json(),q=d["Global Quote"]
   if(!q?.["05. price"]){if(d.Note||d.Information)return NextResponse.json({error:"The market provider is busy. Enter the ticker and price manually, or try again shortly."},{status:429});return NextResponse.json({error:"Ticker not found. You can still record it manually by entering a purchase price."},{status:404})}
   base={symbol,name:symbol,price:Number(q["05. price"]),change24h:Number(String(q["10. change percent"]||"0").replace("%","")),currency:stockCurrency(symbol),source:"Alpha Vantage"}
  }else{
   const common:Record<string,string>={BTC:"bitcoin",ETH:"ethereum",SOL:"solana",XRP:"ripple",ADA:"cardano",DOGE:"dogecoin",AVAX:"avalanche-2",LINK:"chainlink",DOT:"polkadot",MATIC:"matic-network",BNB:"binancecoin"},id=common[symbol]||symbol.toLowerCase(),headers:Record<string,string>={};if(process.env.COINGECKO_API_KEY)headers["x-cg-demo-api-key"]=process.env.COINGECKO_API_KEY
   const r=await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd&include_24hr_change=true`,{headers,cache:"no-store"}),d=await r.json()
   if(!d[id]?.usd)return NextResponse.json({error:"Crypto not found. You can still record any symbol manually by entering its purchase price."},{status:404})
   base={symbol,name:id,price:Number(d[id].usd),change24h:Number(d[id].usd_24h_change||0),currency:"USD",source:"CoinGecko"}
  }
  const fx=await convert(base.price,base.currency,currency),result={...base,originalPrice:base.price,originalCurrency:base.currency,price:fx.price,currency,exchangeRate:fx.rate};quotes.set(cacheKey,{until:Date.now()+(type==="stock"?300000:60000),data:result});return NextResponse.json(result)
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"We could not load the price right now."},{status:502})}
}

