import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/supabase"

type Resource = "clients" | "projects"

async function session() {
  const token = (await cookies()).get("orbit_session")?.value
  return token ? await getSession(token) : null
}

export async function PATCH(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const user = await session()
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 })

  const { resource: raw } = await params
  if (raw !== "clients" && raw !== "projects") {
    return NextResponse.json({ error: "This archive is unavailable." }, { status: 404 })
  }
  const resource = raw as Resource

  try {
    const body = await request.json()
    const id = String(body?.id || "")
    const archived = Boolean(body?.archived)
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid record." }, { status: 400 })

    const rows = await db(`${resource}?id=eq.${encodeURIComponent(id)}&user_id=eq.${user.id}&select=id,archived&limit=1`)
    if (!rows?.[0]) return NextResponse.json({ error: "You cannot change this record." }, { status: 403 })

    if (archived && !rows[0].archived) {
      const archivedRows = await db(`${resource}?user_id=eq.${user.id}&archived=eq.true&select=id&limit=51`)
      if ((archivedRows || []).length >= 50) {
        return NextResponse.json({ error: `Your archived ${resource} list is full. Restore or delete an item before archiving another.` }, { status: 409 })
      }
    }

    const updated = await db(`${resource}?id=eq.${encodeURIComponent(id)}&user_id=eq.${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({ archived, updated_at: new Date().toISOString() }),
    })
    return NextResponse.json({ item: updated?.[0] || { id, archived } })
  } catch (error) {
    console.error("Orbit archive update failed", error)
    return NextResponse.json({ error: "We could not update the archive. Your record is still safe." }, { status: 500 })
  }
}
