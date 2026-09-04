import { db } from "@/lib/supabase"

export type SupportSender = "user" | "orbit_ai" | "support_agent" | "system"

export async function getOrCreateOpenConversation(userId: string, subject = "Orbit Support") {
  const existing = await db(
    `support_conversations?user_id=eq.${encodeURIComponent(userId)}&status=in.(open,pending)&select=id,user_id,status,subject,human_requested,ai_enabled,last_message_at,created_at,updated_at&order=last_message_at.desc&limit=1`,
  )
  if (existing?.[0]) return existing[0]

  const created = await db("support_conversations", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, subject }),
  })
  return created?.[0] || null
}

export async function addSupportMessage(conversationId: string, sender: SupportSender, content: string) {
  const rows = await db("support_messages", {
    method: "POST",
    body: JSON.stringify({ conversation_id: conversationId, sender, content: content.trim().slice(0, 4000) }),
  })
  await db(`support_conversations?id=eq.${encodeURIComponent(conversationId)}`, {
    method: "PATCH",
    body: JSON.stringify({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  })
  return rows?.[0] || null
}

export async function markHumanRequested(conversationId: string) {
  await db(`support_conversations?id=eq.${encodeURIComponent(conversationId)}`, {
    method: "PATCH",
    body: JSON.stringify({ human_requested: true, status: "pending", updated_at: new Date().toISOString() }),
  })
}

export async function listConversationMessages(conversationId: string) {
  return (
    (await db(
      `support_messages?conversation_id=eq.${encodeURIComponent(conversationId)}&select=id,conversation_id,sender,content,created_at&order=created_at.asc&limit=500`,
    )) || []
  )
}
