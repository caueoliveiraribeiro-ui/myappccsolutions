import { createHmac, randomBytes } from "node:crypto"
import { db } from "@/lib/supabase"
import { tokenHash } from "@/lib/password-tokens"
import { APP_ORIGIN } from "@/lib/registration"

const OWNER_IDS = new Set([
  "00000000-0000-4000-8000-000000000001",
  "c38a52ed-766f-47b1-abbd-bc8e152dcaa9",
])

export type ResetIssueResult =
  | { ok: true; email: string }
  | { ok: false; code: "not_found" | "protected" | "not_configured" | "rate_limited" | "email_failed" | "database_failed"; detail?: string }

export function validEmail(email: string) {
  return email.length <= 254 && /^\S+@\S+\.\S+$/.test(email)
}

async function consumePublicRate(bucket: string, limit: number) {
  const now = new Date()
  const rows = await db(`orbit_password_reset_rates?bucket=eq.${encodeURIComponent(bucket)}&select=hits,reset_at&limit=1`)
  const row = rows?.[0] as { hits?: number; reset_at?: string } | undefined
  const nextReset = new Date(now.getTime() + 60 * 60 * 1000).toISOString()

  if (!row) {
    try {
      await db("orbit_password_reset_rates", {
        method: "POST",
        body: JSON.stringify({ bucket, hits: 1, reset_at: nextReset }),
      })
      return true
    } catch {
      const reread = await db(`orbit_password_reset_rates?bucket=eq.${encodeURIComponent(bucket)}&select=hits,reset_at&limit=1`)
      const current = reread?.[0] as { hits?: number; reset_at?: string } | undefined
      if (!current) return false
      const resetAt = current.reset_at ? new Date(current.reset_at) : new Date(0)
      const hits = resetAt <= now ? 1 : Number(current.hits || 0) + 1
      await db(`orbit_password_reset_rates?bucket=eq.${encodeURIComponent(bucket)}`, {
        method: "PATCH",
        body: JSON.stringify({ hits, reset_at: resetAt <= now ? nextReset : resetAt.toISOString() }),
      })
      return hits <= limit
    }
  }

  const resetAt = row.reset_at ? new Date(row.reset_at) : new Date(0)
  const hits = resetAt <= now ? 1 : Number(row.hits || 0) + 1
  await db(`orbit_password_reset_rates?bucket=eq.${encodeURIComponent(bucket)}`, {
    method: "PATCH",
    body: JSON.stringify({ hits, reset_at: resetAt <= now ? nextReset : resetAt.toISOString() }),
  })
  return hits <= limit
}

export async function issuePasswordReset(emailInput: string, options?: { publicIp?: string; bypassPublicRate?: boolean }): Promise<ResetIssueResult> {
  const email = emailInput.trim().toLowerCase()
  if (!validEmail(email)) return { ok: false, code: "not_found" }

  const resendKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  const secret = process.env.SESSION_SECRET
  if (!resendKey || !from || !secret || secret.length < 32) {
    return { ok: false, code: "not_configured" }
  }

  if (!options?.bypassPublicRate) {
    const ip = options?.publicIp || "unknown"
    const ipHash = createHmac("sha256", secret).update(ip).digest("hex")
    const emailHash = createHmac("sha256", secret).update(email).digest("hex")
    const ipAllowed = await consumePublicRate(`ip:${ipHash}`, 10)
    const emailAllowed = await consumePublicRate(`email:${emailHash}`, 3)
    if (!ipAllowed || !emailAllowed) return { ok: false, code: "rate_limited" }
  }

  let users: any[]
  try {
    users = await db(`app_users?email=eq.${encodeURIComponent(email)}&select=id,email&limit=1`)
  } catch (error) {
    return { ok: false, code: "database_failed", detail: error instanceof Error ? error.message : String(error) }
  }

  const user = users?.[0] as { id?: string; email?: string } | undefined
  if (!user?.id) return { ok: false, code: "not_found" }
  if (OWNER_IDS.has(user.id) || email === process.env.ADMIN_EMAIL?.trim().toLowerCase()) {
    return { ok: false, code: "protected" }
  }

  const token = randomBytes(32).toString("hex")
  const hashedToken = tokenHash(token)
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

  try {
    await db("orbit_password_setup_tokens?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        user_id: user.id,
        token_hash: hashedToken,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      }),
    })
  } catch (error) {
    return { ok: false, code: "database_failed", detail: error instanceof Error ? error.message : String(error) }
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Reset your Orbit LM password",
      text: `We received a request to reset your Orbit LM password.\n\nUse this one-time link:\n${APP_ORIGIN}/reset-password?token=${token}\n\nThis link expires in 30 minutes and can only be used once. If you did not request this, you can ignore this email.`,
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    await db(`orbit_password_setup_tokens?token_hash=eq.${encodeURIComponent(hashedToken)}`, { method: "DELETE" }).catch(() => {})
    return { ok: false, code: "email_failed", detail: `${response.status}: ${detail}` }
  }

  return { ok: true, email }
}
