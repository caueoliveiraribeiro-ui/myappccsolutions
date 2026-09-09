import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSession } from "@/lib/auth"
import { ownerAccountIds } from "@/lib/plan-access"
import { db } from "@/lib/supabase"

export async function GET() {
  const token = (await cookies()).get("orbit_session")?.value
  const user = token ? await getSession(token) : null
  if (!user || !ownerAccountIds.has(user.id)) return NextResponse.json({ error: "Owner access required." }, { status: 403 })
  const events = await db("orbit_operational_events?select=*&order=occurred_at.desc&limit=80").catch(() => [])
  const errors = events.filter((event: any) => event.severity === "error").length
  return NextResponse.json({ events, summary: { total: events.length, errors, healthy: errors === 0 } }, { headers: { "Cache-Control": "no-store" } })
}
