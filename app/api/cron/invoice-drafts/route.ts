import { NextResponse } from "next/server"
import { db } from "@/lib/supabase"
import { accountAccess } from "@/lib/plan-access"
import { deliverInvoice, invoiceEmailConfigured } from "@/lib/invoice-delivery"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await db("rpc/orbit_create_all_invoice_drafts", {
      method: "POST",
      body: JSON.stringify({}),
    })
    const created = Number(result ?? 0)
    if (!invoiceEmailConfigured()) throw new Error("Invoice email is not configured.")
    const candidates = await db("rpc/orbit_due_invoice_emails", { method: "POST", body: "{}" })
    let sent = 0, skipped = 0, failed = 0
    const started = Date.now()
    for (const candidate of candidates || []) {
      if (Date.now() - started > 220000) {
        console.error("INVOICE_EMAIL_BATCH_INCOMPLETE")
        failed++
        break
      }
      const access = await accountAccess(candidate.user_id)
      if (!access.features.includes("invoices")) { skipped++; continue }
      try {
        const result = await deliverInvoice(candidate.id, candidate.user_id, candidate.reply_to, true)
        if (result.skipped) skipped++
        else sent++
      } catch {
        failed++
        console.error("INVOICE_EMAIL_REVIEW_REQUIRED", { invoiceId: candidate.id })
      }
      // Respect provider limits; no recipient data or secrets in cron logs.
      await new Promise(resolve => setTimeout(resolve, 600))
    }
    console.log("INVOICE_DRAFT_CRON_COMPLETED", { created, sent, skipped, failed })
    return NextResponse.json({ ok: failed === 0, created, sent, skipped, failed }, { status: failed ? 503 : 200 })
  } catch (error) {
    console.error("INVOICE_DRAFT_CRON_FAILED", {
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Invoice draft automation could not complete." }, { status: 503 })
  }
}
