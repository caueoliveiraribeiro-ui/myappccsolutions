import{NextResponse}from"next/server";import{cookies}from"next/headers";import{verifySession}from"@/lib/auth"
const quotes=new Map<string,{until:number,data:Record<string,unknown>}>();
async function authorized(){const token=(await cookies()).get("orbit_session")?.value;return Boolean(token&&await verifySession(token))}
export async function GET(request:Request){
 if(!await authorized())return NextResponse.json({error:"Your session expired. Please sign in again."},{status:401});
 const u=new URL(request.url),type=u.searchParams.get("type"),symbol=(u.searchParams.get("symbol")||"").trim().toUpperCase();
 if(!symbol||!["stock","crypto"].includes(type||""))return NextResponse.json({error:"Enter a valid stock or crypto symbol."},{status:400});
 const cacheKey=`${type}:${symbol}`,cached=quotes.get(cacheKey);if(cached&&cached.until>Date.now())return NextResponse.json(cached.data);
 try{
  if(type==="stock"){
   const key=process.env.ALPHA_VANTAGE_API_KEY;if(!key)return NextResponse.json({error:"Stock prices are not connected yet. Ask the administrator to check the Alpha Vantage key."},{status:503});
   const r=await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${key}`,{cache:"no-store"}),d=await r.json(),q=d["Global Quote"];
   if(!q?.["05. price"]){if(d.Note||d.Information)return NextResponse.json({error:"Market data is busy. Wait one minute and try again."},{status:429});return NextResponse.json({error:"We could not recognize this ticker. Check the symbol and your default country."},{status:404})}
   const result={symbol,name:symbol,price:Number(q["05. price"]),change24h:Number(String(q["10. change percent"]||"0").replace("%","")),currency:"USD",source:"Alpha Vantage"};quotes.set(cacheKey,{until:Date.now()+5*60*1000,data:result});return NextResponse.json(result);
  }
  const common:Record<string,string>={BTC:"bitcoin",ETH:"ethereum",SOL:"solana",XRP:"ripple",ADA:"cardano",DOGE:"dogecoin",AVAX:"avalanche-2",LINK:"chainlink",DOT:"polkadot",MATIC:"matic-network",BNB:"binancecoin"};
  const id=common[symbol]||symbol.toLowerCase(),headers:Record<string,string>={};if(process.env.COINGECKO_API_KEY)headers["x-cg-demo-api-key"]=process.env.COINGECKO_API_KEY;
  const r=await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd&include_24hr_change=true`,{headers,cache:"no-store"}),d=await r.json();
  if(!d[id]?.usd)return NextResponse.json({error:"We could not recognize this crypto. Try BTC, ETH, SOL or its CoinGecko coin ID."},{status:404});
  const result={symbol,name:id,price:Number(d[id].usd),change24h:Number(d[id].usd_24h_change||0),currency:"USD",source:"CoinGecko"};quotes.set(cacheKey,{until:Date.now()+60*1000,data:result});return NextResponse.json(result);
 }catch{return NextResponse.json({error:"We could not reach the price service. Please try again shortly."},{status:502})}
}

