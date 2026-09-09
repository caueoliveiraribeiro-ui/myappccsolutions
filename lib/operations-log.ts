import { db } from "@/lib/supabase"

type Source = "invoice_cron" | "invoice_email" | "hotmart_webhook"
type Severity = "info" | "warning" | "error"

export async function recordOperationalEvent(source: Source, severity: Severity, eventType: string, message: string, metadata: Record<string, unknown> = {}) {
  try {
    await db("orbit_operational_events", { method: "POST", body: JSON.stringify({ source, severity, event_type: eventType, message, metadata }) })
  } catch (error) {
    console.error("ORBIT_OPERATIONAL_EVENT_WRITE_FAILED", { source, eventType, message: error instanceof Error ? error.message : String(error) })
  }
}

export async function recordFinancialAudit(input: {
  actorUserId: string | null
  ownerUserId: string
  resourceType: "invoice" | "payment" | "client_billing"
  resourceId: string
  action: "created" | "updated" | "deleted" | "sent" | "automation"
  before?: unknown
  after?: unknown
  requestSource?: string
}) {
  try {
    await db("financial_audit_log", { method: "POST", body: JSON.stringify({
      actor_user_id: input.actorUserId,
      owner_user_id: input.ownerUserId,
      resource_type: input.resourceType,
      resource_id: input.resourceId,
      action: input.action,
      before_data: input.before ?? null,
      after_data: input.after ?? null,
      request_source: input.requestSource || "application",
    }) })
  } catch (error) {
    console.error("ORBIT_FINANCIAL_AUDIT_WRITE_FAILED", { resourceType: input.resourceType, resourceId: input.resourceId, message: error instanceof Error ? error.message : String(error) })
  }
}
