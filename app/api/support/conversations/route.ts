import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSession } from "@/lib/auth"
import { getOrCreateOpenConversation, listConversationMessages } from "@/lib/support-store"

export async function GET() {
  const token = (await cookies()).get("orbit_session")?.value
  const user = token ? await getSession(token) : null
  if (!user) return NextResponse.json({ conversation: null, messages: [] }, { headers: { "Cache-Control": "no-store" } })

  try {
    const conversation = await getOrCreateOpenConversation(user.id)
    const messages = conversation ? await listConversationMessages(conversation.id) : []
    return NextResponse.json({ conversation, messages }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("ORBIT_SUPPORT_CONVERSATION_GET_FAILED", error)
    return NextResponse.json({ error: "Could not load support conversation" }, { status: 503 })
  }
}

export async function POST(req: NextRequest) {
  const token = (await cookies()).get("orbit_session")?.value
  const user = token ? await getSession(token) : null
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }) }
  const data = body && typeof body === "object" ? body as Record<string, unknown> : {}
  const subject = typeof data.subject === "string" ? data.subject.trim().slice(0, 120) : "Orbit Support"

  try {
    const conversation = await getOrCreateOpenConversation(user.id, subject || "Orbit Support")
    return NextResponse.json({ conversation }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("ORBIT_SUPPORT_CONVERSATION_CREATE_FAILED", error)
    return NextResponse.json({ error: "Could not create support conversation" }, { status: 503 })
  }
}
