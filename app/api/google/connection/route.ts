import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/supabase"

async function currentUser(request: NextRequest) {
  const token = request.cookies.get("orbit_session")?.value
  return token ? getSession(token) : null
}

export async function GET(request: NextRequest) {
  const user = await currentUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rows = await db(
    `gmail_connections?user_id=eq.${encodeURIComponent(user.id)}&select=google_email,updated_at&limit=1`,
  )
  const connection = rows?.[0]

  return NextResponse.json(
    {
      connected: Boolean(connection?.google_email),
      email: connection?.google_email || null,
      updatedAt: connection?.updated_at || null,
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}

export async function DELETE(request: NextRequest) {
  const user = await currentUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await db(`gmail_connections?user_id=eq.${encodeURIComponent(user.id)}`, {
    method: "DELETE",
  })

  return NextResponse.json({ disconnected: true })
}
