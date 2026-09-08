import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/supabase"
import { accountAccess, upgradeResponse, planWriteError } from "@/lib/plan-access"

type Resource = "clients" | "projects"
type Context = { params: Promise<{ resource: string }> }

async function session() {
  const token = (await cookies()).get("orbit_session")?.value
  return token ? await getSession(token) : null
}

async function resourceFrom(params: Context["params"]) {
  const { resource } = await params
  return resource === "clients" || resource === "projects" ? resource as Resource : null
}

export async function GET(_: Request, { params }: Context) {
  const user = await session()
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 })

    const resource = await resourceFrom(params)
  if (!resource) return NextResponse.json({ error: "This archive is unavailable." }, { status: 404 })

  if (!(await accountAccess(user.id)).features.includes(resource)) return upgradeResponse()

  try {
    const items = await db(`${resource}?user_id=eq.${user.id}&archived=eq.true&select=*&order=updated_at.desc&limit=50`)
    return NextResponse.json({ items: items || [], limit: 50 })
  } catch (error) {
    console.error("Orbit archive load failed", error)
    return NextResponse.json({ error: "Archive storage is unavailable. Your active records are still safe." }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: Context) {
  const user = await session()
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 })

  const resource = await resourceFrom(params)
  if (!resource) return NextResponse.json({ error: "This archive is unavailable." }, { status: 404 })

  if (!(await accountAccess(user.id)).features.includes(resource)) return upgradeResponse()

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
        return NextResponse.json({ error: `Your archived ${resource} list is full. Restore an item before archiving another.` }, { status: 409 })
      }
    }

    const updated = await db(`${resource}?id=eq.${encodeURIComponent(id)}&user_id=eq.${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({ archived, updated_at: new Date().toISOString() }),
    })
    return NextResponse.json({ item: updated?.[0] || { id, archived } })
  } catch (error) {
    console.error("Orbit archive update failed", error)
    return planWriteError(error) || NextResponse.json({ error: "We could not update the archive. Your record is still safe." }, { status: 500 })
  }
}
