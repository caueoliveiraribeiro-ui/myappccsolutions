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
  if (!(await accountAccess(user.id)).features.includes("invoices")) return upgradeResponse()
  const rows = await db(`invoice_branding?user_id=eq.${encodeURIComponent(user.id)}&select=company_name,logo_data_url&limit=1`).catch(() => [])
  return NextResponse.json({ branding: rows?.[0] || { company_name: "", logo_data_url: "" } })
}
export async function POST(request: Request) {
  const user = await userForRequest()
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 })
  if (!(await accountAccess(user.id)).features.includes("invoices")) return upgradeResponse()
  try {
    const input = await request.json()
    const logo = String(input.logo_data_url || "")
    if (logo && (!/^data:image\/(png|jpeg|webp);base64,/i.test(logo) || logo.length > 1_300_000)) return NextResponse.json({ error: "Use a JPG, PNG, or WebP logo smaller than 2.5 MB after optimization." }, { status: 400 })
    const payload = {
      company_name: String(input.company_name || "").trim() || null,
      logo_data_url: logo || null,
      updated_at: new Date().toISOString(),
    }
    const existing = await db(`invoice_branding?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`)
    const rows = existing?.[0]
      ? await db(`invoice_branding?user_id=eq.${encodeURIComponent(user.id)}`, { method: "PATCH", body: JSON.stringify(payload) })
      : await db("invoice_branding", { method: "POST", body: JSON.stringify({ user_id: user.id, ...payload }) })
    if (!rows?.[0]) throw new Error("The invoice brand was not confirmed by the database.")
    return NextResponse.json({ branding: rows[0] })
  } catch (error) {
    console.error("INVOICE_BRANDING_SAVE_FAILED", {
      userId: user.id,
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "We could not save your invoice brand. Please try again." }, { status: 503 })
  }
}