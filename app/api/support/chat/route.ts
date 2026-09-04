import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSession } from "@/lib/auth"
import { answerOrbitSupport, type OrbitSupportContext } from "@/lib/orbit-support-agent"

const MAX_BODY_BYTES = 16_384
const MAX_MESSAGE_CHARS = 2_000

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin")
  if (!origin) return true
  try {
    return new URL(origin).host === req.nextUrl.host
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 })

  const token = (await cookies()).get("orbit_session")?.value
  const user = token ? await getSession(token) : null
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const length = Number(req.headers.get("content-length") || 0)
  if (length > MAX_BODY_BYTES) return NextResponse.json({ error: "Request too large" }, { status: 413 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const data = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const message = typeof data.message === "string" ? data.message.trim() : ""
  if (!message || message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json({ error: "Message must be between 1 and 2000 characters" }, { status: 400 })
  }

  const rawContext = data.context && typeof data.context === "object" ? (data.context as Record<string, unknown>) : {}
  const context: OrbitSupportContext = {
    page: typeof rawContext.page === "string" ? rawContext.page.slice(0, 80) : undefined,
    plan: typeof rawContext.plan === "string" ? rawContext.plan.slice(0, 80) : undefined,
    features: Array.isArray(rawContext.features)
      ? rawContext.features.filter((item): item is string => typeof item === "string").slice(0, 50)
      : undefined,
  }

  try {
    const result = await answerOrbitSupport(message, context)
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("Orbit support agent failed", error)
    return NextResponse.json({ error: "Orbit Support is temporarily unavailable" }, { status: 503 })
  }
}
