import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSession } from "@/lib/auth"
import { ownerAccountIds } from "@/lib/plan-access"
import { db } from "@/lib/supabase"
import { addSupportMessage, listConversationMessages } from "@/lib/support-store"

async function owner() {
  const token = (await cookies()).get("orbit_session")?.value
  const user = token ? await getSession(token) : null
  return user && ownerAccountIds.has(user.id) ? user : null
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest) {
  if (!(await owner())) return NextResponse.json({ error: "Owner access required." }, { status: 403 })

  try {
    const id = req.nextUrl.searchParams.get("id") || ""
    if (id) {
      if (!uuidPattern.test(id)) return NextResponse.json({ error: "Invalid conversation." }, { status: 400 })
      const conversations = await db(`support_conversations?id=eq.${encodeURIComponent(id)}&select=*&limit=1`)
      const conversation = conversations?.[0]
      if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 })
      const messages = await listConversationMessages(id)
      let member = null
      if (conversation.user_id) {
        const users = await db(`app_users?id=eq.${encodeURIComponent(conversation.user_id)}&select=id,name,email&limit=1`)
        member = users?.[0] || null
      }
      return NextResponse.json({ conversation, member, messages }, { headers: { "Cache-Control": "no-store" } })
    }

    const status = req.nextUrl.searchParams.get("status") || "all"
    const allowed = new Set(["all", "open", "pending", "resolved"])
    if (!allowed.has(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 })
    const filter = status === "all" ? "" : `&status=eq.${encodeURIComponent(status)}`
    const conversations = (await db(`support_conversations?select=*&order=last_message_at.desc&limit=100${filter}`)) || []
    const userIds = [...new Set(conversations.map((row: any) => row.user_id).filter(Boolean))]
    let users: any[] = []
    if (userIds.length) users = (await db(`app_users?id=in.(${userIds.join(",")})&select=id,name,email`)) || []
    const userMap = new Map(users.map((user: any) => [user.id, user]))
    const rows = conversations.map((conversation: any) => ({
      ...conversation,
      member: conversation.user_id ? userMap.get(conversation.user_id) || null : null,
    }))
    const metrics = {
      open: conversations.filter((row: any) => row.status === "open").length,
      pending: conversations.filter((row: any) => row.status === "pending").length,
      resolved: conversations.filter((row: any) => row.status === "resolved").length,
      humanRequested: conversations.filter((row: any) => row.human_requested).length,
    }
    return NextResponse.json({ conversations: rows, metrics }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("ORBIT_ADMIN_SUPPORT_GET_FAILED", error)
    return NextResponse.json({ error: "Could not load Support Inbox." }, { status: 503 })
  }
}

export async function POST(req: NextRequest) {
  const admin = await owner()
  if (!admin) return NextResponse.json({ error: "Owner access required." }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }) }
  const data = body && typeof body === "object" ? body as Record<string, unknown> : {}
  const conversationId = typeof data.conversationId === "string" ? data.conversationId : ""
  const content = typeof data.content === "string" ? data.content.trim() : ""
  if (!uuidPattern.test(conversationId) || !content || content.length > 4000) {
    return NextResponse.json({ error: "A valid conversation and message are required." }, { status: 400 })
  }

  try {
    const conversations = await db(`support_conversations?id=eq.${encodeURIComponent(conversationId)}&select=id&limit=1`)
    if (!conversations?.[0]) return NextResponse.json({ error: "Conversation not found." }, { status: 404 })
    const message = await addSupportMessage(conversationId, "support_agent", content)
    await db(`support_conversations?id=eq.${encodeURIComponent(conversationId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "open", human_requested: false, updated_at: new Date().toISOString() }),
    })
    return NextResponse.json({ message })
  } catch (error) {
    console.error("ORBIT_ADMIN_SUPPORT_REPLY_FAILED", error)
    return NextResponse.json({ error: "Could not send support reply." }, { status: 503 })
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await owner())) return NextResponse.json({ error: "Owner access required." }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }) }
  const data = body && typeof body === "object" ? body as Record<string, unknown> : {}
  const conversationId = typeof data.conversationId === "string" ? data.conversationId : ""
  const status = typeof data.status === "string" ? data.status : ""
  if (!uuidPattern.test(conversationId) || !["open", "pending", "resolved"].includes(status)) {
    return NextResponse.json({ error: "Invalid conversation status." }, { status: 400 })
  }

  try {
    await db(`support_conversations?id=eq.${encodeURIComponent(conversationId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("ORBIT_ADMIN_SUPPORT_STATUS_FAILED", error)
    return NextResponse.json({ error: "Could not update conversation." }, { status: 503 })
  }
}
