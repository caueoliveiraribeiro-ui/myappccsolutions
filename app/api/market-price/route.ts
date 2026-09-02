import{NextResponse}from"next/server";import{cookies}from"next/headers";import{verifySession}from"@/lib/auth"
async function authorized(){const token=(await cookies()).get("orbit_session")?.value;return Boolean(token&&await verifySession(token))}
export async function GET(request:Request){
 if(!await authorized())return NextResponse.json({error:"Unauthorized"},{status:401});
 const u=new URL(request.url),type=u.searchParams.get("type"),symbol=(u.searchParams.get("symbol")||"").trim().toUpperCase();
 if(!symbol||!["stock","crypto"].includes(type||""))return NextResponse.json({error:"Choose a valid asset and symbol."},{status:400});
 try{
  if(type==="stock"){
   const key=process.env.ALPHA_VANTAGE_API_KEY;if(!key)return NextResponse.json({error:"Add ALPHA_VANTAGE_API_KEY in Vercel."},{status:503});
   const r=await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${key}`,{cache:"no-store"}),d=await r.json(),q=d["Global Quote"];
   if(!q?.["05. price"])throw Error(d.Note||d.Information||"Ticker not found");
   return NextResponse.json({symbol,name:symbol,price:Number(q["05. price"]),change24h:Number(String(q["10. change percent"]||"0").replace("%","")),currency:"USD",source:"Alpha Vantage"});
  }
  const common:Record<string,string>={BTC:"bitcoin",ETH:"ethereum",SOL:"solana",XRP:"ripple",ADA:"cardano",DOGE:"dogecoin",AVAX:"avalanche-2",LINK:"chainlink",DOT:"polkadot",MATIC:"matic-network",BNB:"binancecoin"};
  const id=common[symbol]||symbol.toLowerCase(),headers:Record<string,string>={};if(process.env.COINGECKO_API_KEY)headers["x-cg-demo-api-key"]=process.env.COINGECKO_API_KEY;
  const r=await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd&include_24hr_change=true`,{headers,cache:"no-store"}),d=await r.json();
  if(!d[id]?.usd)throw Error("Crypto symbol not found. Try BTC, ETH, SOL or a CoinGecko coin ID.");
  return NextResponse.json({symbol,name:id,price:Number(d[id].usd),change24h:Number(d[id].usd_24h_change||0),currency:"USD",source:"CoinGecko"});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Price lookup failed"},{status:502})}
}

