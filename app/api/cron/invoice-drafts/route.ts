import { NextResponse } from "next/server"
import { db } from "@/lib/supabase"

export const dynamic = "force-dynamic"

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
    console.log("INVOICE_DRAFT_CRON_COMPLETED", { created })
    return NextResponse.json({ ok: true, created })
  } catch (error) {
    console.error("INVOICE_DRAFT_CRON_FAILED", {
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Invoice draft automation could not complete." }, { status: 503 })
  }
}
