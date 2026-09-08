import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSession } from "@/lib/auth"
import { accountAccess, upgradeResponse } from "@/lib/plan-access"
import { db } from "@/lib/supabase"
import { invoicePdf } from "@/lib/invoice-pdf"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get("orbit_session")?.value
  const user = token ? await getSession(token) : null
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 })
  const access = await accountAccess(user.id)
  if (!access.features.includes("reports")) return upgradeResponse()
  const { id } = await params
  const invoices = await db(`invoices?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}&select=*&limit=1`)
  const invoice = invoices?.[0]
  if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 })
  const pdf = invoicePdf(invoice)
  const filename = `invoice-${String(invoice.invoice_number).replace(/[^a-z0-9_-]/gi, "-")}.pdf`
  return new NextResponse(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store" } })
}
