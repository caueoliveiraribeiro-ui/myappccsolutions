import {requestFeature} from "@/lib/plan-access"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession } from "@/lib/auth"

const supported = new Set(["USD", "BRL", "EUR", "GBP", "CAD", "AUD", "JPY", "KRW", "MXN", "CHF"])

export async function GET(request: Request) {const planDenied=await requestFeature("overview");if(planDenied)return planDenied;
  const token = (await cookies()).get("orbit_session")?.value
  if (!token || !(await verifySession(token))) {
    return NextResponse.json({ error: "Your session expired. Please sign in again." }, { status: 401 })
  }

  const url = new URL(request.url)
  const from = (url.searchParams.get("from") || "USD").toUpperCase()
  const to = (url.searchParams.get("to") || "USD").toUpperCase()
  if (!supported.has(from) || !supported.has(to)) {
    return NextResponse.json({ error: "This currency is not supported yet." }, { status: 400 })
  }
  if (from === to) return NextResponse.json({ from, to, rate: 1 })

  try {
    const response = await fetch(`https://api.frankfurter.dev/v2/rate/${encodeURIComponent(from)}/${encodeURIComponent(to)}`, {
      next: { revalidate: 21600 },
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !Number.isFinite(Number(data.rate))) throw new Error()
    return NextResponse.json({ from, to, rate: Number(data.rate) })
  } catch {
    return NextResponse.json({ error: "Currency conversion is temporarily unavailable. Please try again shortly." }, { status: 502 })
  }
}
