import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSession } from "@/lib/auth"
import { accountAccess, upgradeResponse } from "@/lib/plan-access"
import { db } from "@/lib/supabase"

const validStatus = new Set(["draft", "sent", "paid", "overdue", "void"])
const isoDate = (value: unknown, fallback: string | null) => {
  const date = String(value || "").trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : fallback
}

export async function POST(request: Request) {
  const token = (await cookies()).get("orbit_session")?.value
  const user = token ? await getSession(token) : null
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 })

  const access = await accountAccess(user.id)
  if (!access.features.includes("reports")) return upgradeResponse()

  try {
    const input = await request.json()
    const client_name = String(input.client_name || "").trim()
    const requestedNumber = String(input.invoice_number || "").trim()
    const amount = Number(input.amount)
    if (!client_name || !Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: "Add a client name and a valid amount to create this invoice." }, { status: 400 })
    }

    const issuedToday = new Date().toISOString().slice(0, 10)
    let invoice_number = requestedNumber || `ORB-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`
    const existing = await db(`invoices?user_id=eq.${encodeURIComponent(user.id)}&invoice_number=eq.${encodeURIComponent(invoice_number)}&select=id&limit=1`)
    if (existing?.[0]) {
      const prefix = `ORB-${new Date().getFullYear()}-`
      invoice_number = `${prefix}${Date.now().toString().slice(-6)}`
    }

    const currency = String(input.currency || "USD").trim().toUpperCase()
    const row = {
      user_id: user.id,
      client_id: typeof input.client_id === "string" && /^[0-9a-f-]{36}$/i.test(input.client_id) ? input.client_id : null,
      project_id: typeof input.project_id === "string" && /^[0-9a-f-]{36}$/i.test(input.project_id) ? input.project_id : null,
      client_name,
      client_email: String(input.client_email || "").trim() || null,
      client_company_name: String(input.client_company_name || "").trim() || null,
      client_logo_url: /^https:\/\//i.test(String(input.client_logo_url || "").trim()) ? String(input.client_logo_url).trim() : null,
      invoice_number,
      service_name: String(input.service_name || "").trim() || "Professional services",
      amount,
      currency: /^[A-Z]{3}$/.test(currency) ? currency : "USD",
      issue_date: isoDate(input.issue_date, issuedToday),
      due_date: isoDate(input.due_date, null),
      status: validStatus.has(String(input.status || "").toLowerCase()) ? String(input.status).toLowerCase() : "draft",
      notes: String(input.notes || "").trim() || null,
    }

    const invoices = await db("invoices", { method: "POST", body: JSON.stringify(row) })
    const invoice = invoices?.[0]
    if (!invoice?.id) throw new Error("The invoice was not confirmed by the database.")
    return NextResponse.json({ invoice }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const detail = error instanceof Error ? error.message : ""
    console.error("INVOICE_CREATE_FAILED", detail)
    if (detail.includes("duplicate key") || detail.includes("invoices_user_id_invoice_number_key")) {
      return NextResponse.json({ error: "That invoice number is already in use. Please try creating the invoice again." }, { status: 409 })
    }
    const friendly = detail.includes("column") && detail.includes("does not exist")
      ? "The invoice system is still updating. Refresh once and try again."
      : "We could not save this invoice. Your other records are safe; please try again."
    return NextResponse.json({ error: friendly }, { status: 503 })
  }
}
