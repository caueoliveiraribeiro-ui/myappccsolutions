import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSession } from "@/lib/auth"
import { accountAccess, upgradeResponse } from "@/lib/plan-access"
import { db } from "@/lib/supabase"
import { invoicePdf } from "@/lib/invoice-pdf"

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get("orbit_session")?.value
  const user = token ? await getSession(token) : null
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 })
  const access = await accountAccess(user.id)
  if (!access.features.includes("invoices")) return upgradeResponse()
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return NextResponse.json({ error: "Invoice email is not configured. Add RESEND_API_KEY and RESEND_FROM_EMAIL in Vercel." }, { status: 503 })

  try {
    const { id } = await params
    const invoices = await db(`invoices?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}&select=*&limit=1`)
    const invoice = invoices?.[0]
    if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 })
    if (!invoice.client_email || !/^\S+@\S+\.\S+$/.test(invoice.client_email)) return NextResponse.json({ error: "Add a valid client email before sending this invoice." }, { status: 400 })
    const filename = `invoice-${String(invoice.invoice_number).replace(/[^a-z0-9_-]/gi, "-")}.pdf`
    const pdf = invoicePdf(invoice).toString("base64")
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL, to: [invoice.client_email], reply_to: user.email,
        subject: `Invoice ${invoice.invoice_number}`,
        text: `Hello ${invoice.client_name},\n\nAttached is your Orbit LM invoice ${invoice.invoice_number}.\n\nThank you.`,
        attachments: [{ filename, content: pdf }],
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.message || "Email provider rejected the invoice.")
    const updated = await db(`invoices?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}`, { method: "PATCH", body: JSON.stringify({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }) })
    return NextResponse.json({ ok: true, invoice: updated?.[0], emailId: data.id })
  } catch (error) {
    console.error("INVOICE_EMAIL_FAILED", error)
    return NextResponse.json({ error: "Invoice email could not be sent. Please verify the client email and your Resend settings." }, { status: 502 })
  }
}
