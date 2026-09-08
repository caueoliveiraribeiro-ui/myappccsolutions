import { db } from "@/lib/supabase"
import { invoicePdf } from "@/lib/invoice-pdf"

export function invoiceEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL)
}

// A database claim is shared by the manual button and cron. Uncertain deliveries
// stay claimed for operator review, never blindly resent after provider dedup expires.
export async function deliverInvoice(id: string, owner: string, replyTo: string, automatic = false) {
  if (!invoiceEmailConfigured()) throw new Error("Invoice email is not configured.")
  const claimed = await db("rpc/orbit_claim_invoice_email", {
    method: "POST",
    body: JSON.stringify({ p_invoice: id, p_owner: owner, p_automatic: automatic }),
  })
  const invoice = claimed?.[0]
  if (!invoice) return { skipped: true as const }
  try {
    const filename = `invoice-${String(invoice.invoice_number).replace(/[^a-z0-9_-]/gi, "-")}.pdf`
    const body = JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: [invoice.client_email],
      reply_to: replyTo,
      subject: `Invoice ${invoice.invoice_number}`,
      text: `Hello ${invoice.client_name},\n\nPlease find your invoice ${invoice.invoice_number} attached as a PDF.${invoice.due_date ? ` Payment is due on ${invoice.due_date}.` : ""}\n\nThank you.`,
      attachments: [{ filename, content: invoicePdf({ ...invoice, status: "sent" }).toString("base64") }],
    })
    let emailId = ""
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `orbit-invoice-${invoice.email_claim_token}`,
          },
          body,
          signal: AbortSignal.timeout(10000),
        })
        const result = await response.json().catch(() => ({}))
        if (response.ok && result.id) { emailId = result.id; break }
        if (response.status < 500 && response.status !== 429) break
      } catch { /* Retry only this identical request with the same provider key. */ }
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
    }
    if (!emailId) throw new Error("Delivery was not confirmed; review the email provider before retrying.")
    const updated = await db("rpc/orbit_complete_invoice_email", {
      method: "POST",
      body: JSON.stringify({ p_invoice: id, p_token: invoice.email_claim_token, p_email_id: emailId }),
    })
    if (!updated?.[0]) throw new Error("Email accepted but invoice status needs review.")
    return { skipped: false as const, invoice: updated[0], emailId }
  } catch (error) {
    await db(`invoices?id=eq.${encodeURIComponent(id)}&email_claim_token=eq.${invoice.email_claim_token}`, {
      method: "PATCH", body: JSON.stringify({ email_delivery_error: "Delivery requires review in the email provider before retrying." }),
    }).catch(() => {})
    throw error
  }
}

