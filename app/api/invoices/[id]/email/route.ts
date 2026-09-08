import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSession } from "@/lib/auth"
import { accountAccess, upgradeResponse } from "@/lib/plan-access"
import { deliverInvoice, invoiceEmailConfigured } from "@/lib/invoice-delivery"

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get("orbit_session")?.value
  const user = token ? await getSession(token) : null
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 })
  const access = await accountAccess(user.id)
  if (!access.features.includes("invoices")) return upgradeResponse()
  if (!invoiceEmailConfigured()) return NextResponse.json({ error: "Invoice email is not configured." }, { status: 503 })
  try {
    const { id } = await params
    const result = await deliverInvoice(id, user.id, user.email)
    if (result.skipped) return NextResponse.json({ error: "This invoice has already been sent, is being processed, or is not ready to send. Check its status and client email." }, { status: 409 })
    return NextResponse.json({ ok: true, invoice: result.invoice, emailId: result.emailId })
  } catch {
    console.error("INVOICE_EMAIL_REVIEW_REQUIRED")
    return NextResponse.json({ error: "We could not confirm delivery. Please contact support before resending so your client does not receive duplicate invoices." }, { status: 502 })
  }
}
