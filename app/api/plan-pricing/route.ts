import { NextResponse } from "next/server"
import { countryCurrency, isPlanCurrency } from "@/lib/plan-pricing"

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("currency")
  if (requested && !isPlanCurrency(requested)) return NextResponse.json({error:"Unsupported currency"}, {status:400})
  const country = (request.headers.get("x-vercel-ip-country") || "").toUpperCase()
  const currency = requested || countryCurrency[country] || "USD"
  const headers = {"Cache-Control":"private, no-store"}
  if (currency === "USD") return NextResponse.json({currency,rate:1,date:null}, {headers})
  try {
    const response = await fetch(`https://api.frankfurter.dev/v2/rate/USD/${currency}`, {
      next:{revalidate:21600}, signal:AbortSignal.timeout(8000),
    })
    if (!response.ok) throw new Error("Rate unavailable")
    const data = await response.json()
    const rate = Number(data.rate)
    if (!Number.isFinite(rate) || rate <= 0) throw new Error("Invalid rate")
    return NextResponse.json({currency,rate,date:data.date}, {headers})
  } catch {
    // Never relabel a USD amount as a foreign currency when a provider fails.
    return NextResponse.json({currency:"USD",rate:1,date:null,fallback:true}, {headers})
  }
}
