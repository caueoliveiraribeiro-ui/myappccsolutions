import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSession } from "@/lib/auth"
import { accountAccess, upgradeResponse } from "@/lib/plan-access"
import { db } from "@/lib/supabase"

export async function POST(request: Request) {
  const token = (await cookies()).get("orbit_session")?.value
  const user = token ? await getSession(token) : null
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 })
  const access = await accountAccess(user.id)
  if (!access.features.includes("reports")) return upgradeResponse()

  try {
    const input = await request.json()
    const client_name = String(input.client_name || "").trim()
    const invoice_number = String(input.invoice_number || "").trim()
    const amount = Number(input.amount)
    if (!client_name || !invoice_number || !Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: "Client name, invoice number, and a valid amount are required." }, { status: 400 })
    }
    const row = {
      user_id: user.id,
      client_id: typeof input.client_id === "string" && input.client_id ? input.client_id : null,
      project_id: typeof input.project_id === "string" && input.project_id ? input.project_id : null,
      client_name,
      client_email: String(input.client_email || "").trim() || null,
      invoice_number,
      service_name: String(input.service_name || "").trim() || null,
      amount,
      currency: String(input.currency || "USD").trim().toUpperCase(),
      issue_date: String(input.issue_date || new Date().toISOString().slice(0, 10)),
      due_date: String(input.due_date || "").trim() || null,
      status: ["draft", "sent", "paid", "overdue", "void"].includes(String(input.status)) ? input.status : "draft",
      notes: String(input.notes || "").trim() || null,
    }
    const invoices = await db("invoices", { method: "POST", body: JSON.stringify(row) })
    return NextResponse.json({ invoice: invoices?.[0] })
  } catch (error) {
    const detail = error instanceof Error ? error.message : ""
    if (detail.includes("duplicate key") || detail.includes("invoices_user_id_invoice_number_key")) {
      return NextResponse.json({ error: "That invoice number is already in use. Choose a different number." }, { status: 409 })
    }
    console.error("INVOICE_CREATE_FAILED", detail)
    return NextResponse.json({ error: "Invoice could not be created. Please verify the details and try again." }, { status: 503 })
  }
}
