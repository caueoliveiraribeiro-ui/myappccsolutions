import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSession } from "@/lib/auth"
import { getOpenConversation, listConversationMessages, resolveOpenConversations } from "@/lib/support-store"

async function currentUser() {
  const token = (await cookies()).get("orbit_session")?.value
  return token ? await getSession(token) : null
}

export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ authenticated: false, conversation: null, messages: [] })

  try {
    const conversation = await getOpenConversation(user.id)
    if (!conversation) {
      return NextResponse.json(
        { authenticated: true, conversation: null, messages: [] },
        { headers: { "Cache-Control": "no-store" } },
      )
    }
    const messages = await listConversationMessages(conversation.id)
    return NextResponse.json(
      { authenticated: true, conversation, messages },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("ORBIT_SUPPORT_CONVERSATION_GET_FAILED", error)
    return NextResponse.json({ error: "Could not load support conversation." }, { status: 503 })
  }
}

export async function DELETE(req: NextRequest) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const origin = req.headers.get("origin")
  if (origin) {
    try {
      if (new URL(origin).host !== req.nextUrl.host) {
        return NextResponse.json({ error: "Invalid origin" }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 })
    }
  }

  try {
    await resolveOpenConversations(user.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("ORBIT_SUPPORT_CONVERSATION_RESET_FAILED", error)
    return NextResponse.json({ error: "Could not start a new conversation." }, { status: 503 })
  }
}
