import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSession } from "@/lib/auth"
import { accountAccess, upgradeResponse } from "@/lib/plan-access"
import { db } from "@/lib/supabase"

async function userForRequest() {
  const token = (await cookies()).get("orbit_session")?.value
  return token ? getSession(token) : null
}
export async function GET() {
  const user = await userForRequest()
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 })
  if (!(await accountAccess(user.id)).features.includes("reports")) return upgradeResponse()
  const rows = await db(`invoice_branding?user_id=eq.${encodeURIComponent(user.id)}&select=company_name,logo_data_url&limit=1`).catch(() => [])
  return NextResponse.json({ branding: rows?.[0] || { company_name: "", logo_data_url: "" } })
}
export async function POST(request: Request) {
  const user = await userForRequest()
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 })
  if (!(await accountAccess(user.id)).features.includes("reports")) return upgradeResponse()
  try {
    const input = await request.json()
    const logo = String(input.logo_data_url || "")
    if (logo && (!/^data:image\/(png|jpeg|webp);base64,/i.test(logo) || logo.length > 3_700_000)) return NextResponse.json({ error: "Use a JPG, PNG, or WebP logo smaller than 2.5 MB." }, { status: 400 })
    const rows = await db("invoice_branding", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ user_id: user.id, company_name: String(input.company_name || "").trim() || null, logo_data_url: logo || null, updated_at: new Date().toISOString() }) })
    return NextResponse.json({ branding: rows?.[0] || {} })
  } catch { return NextResponse.json({ error: "We could not save your invoice brand." }, { status: 503 }) }
}