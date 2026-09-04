import { NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { processHotmartEvent } from "@/lib/hotmart-webhook"

export const runtime = "nodejs"

function secureEqual(a: string, b: string) {
  const aa = Buffer.from(a)
  const bb = Buffer.from(b)
  return aa.length === bb.length && timingSafeEqual(aa, bb)
}

export async function POST(req: Request) {
  const secret = process.env.HOTMART_HOTTOK
  if (!secret) {
    return NextResponse.json({ error: "Hotmart webhook is not configured." }, { status: 503 })
  }

  const supplied = req.headers.get("x-hotmart-hottok") || ""
  if (!supplied || !secureEqual(supplied, secret)) {
    return NextResponse.json({ error: "Invalid Hotmart signature." }, { status: 401 })
  }

  const length = Number(req.headers.get("content-length") || 0)
  if (length > 1048576) return new NextResponse(null, { status: 413 })

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 })
  }

  try {
    const result = await processHotmartEvent(payload as any)
    return NextResponse.json(result)
  } catch (error) {
    console.error("HOTMART_WEBHOOK_FAILED:", error)
    return NextResponse.json({ error: "Hotmart event could not be processed." }, { status: 503 })
  }
}
