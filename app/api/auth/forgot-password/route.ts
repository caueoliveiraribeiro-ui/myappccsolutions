import { createHmac, randomBytes } from "node:crypto"
import { NextResponse } from "next/server"
import { db } from "@/lib/supabase"
import { tokenHash } from "@/lib/password-tokens"
import { APP_ORIGIN } from "@/lib/registration"

export const runtime = "nodejs"

const genericMessage =
  "If an Orbit account exists for this email, a password reset link has been sent."

const OWNER_IDS = new Set([
  "00000000-0000-4000-8000-000000000001",
  "c38a52ed-766f-47b1-abbd-bc8e152dcaa9",
])

async function consumeRate(bucket: string, limit: number) {
  const now = new Date()
  const rows = await db(
    `orbit_registration_rates?bucket=eq.${encodeURIComponent(bucket)}&select=hits,reset_at&limit=1`
  )
  const row = rows?.[0] as { hits?: number; reset_at?: string } | undefined

  if (!row) {
    try {
      await db("orbit_registration_rates", {
        method: "POST",
        body: JSON.stringify({
          bucket,
          hits: 1,
          reset_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        }),
      })
      return true
    } catch {
      // A concurrent request may have created the bucket. Re-read it below.
      const concurrent = await db(
        `orbit_registration_rates?bucket=eq.${encodeURIComponent(bucket)}&select=hits,reset_at&limit=1`
      )
      const current = concurrent?.[0] as
        | { hits?: number; reset_at?: string }
        | undefined
      if (!current) return false
      const resetAt = current.reset_at ? new Date(current.reset_at) : new Date(0)
      const hits = resetAt <= now ? 1 : Number(current.hits || 0) + 1
      await db(`orbit_registration_rates?bucket=eq.${encodeURIComponent(bucket)}`, {
        method: "PATCH",
        body: JSON.stringify({
          hits,
          reset_at:
            resetAt <= now
              ? new Date(now.getTime() + 60 * 60 * 1000).toISOString()
              : resetAt.toISOString(),
        }),
      })
      return hits <= limit
    }
  }

  const resetAt = row.reset_at ? new Date(row.reset_at) : new Date(0)
  const hits = resetAt <= now ? 1 : Number(row.hits || 0) + 1

  await db(`orbit_registration_rates?bucket=eq.${encodeURIComponent(bucket)}`, {
    method: "PATCH",
    body: JSON.stringify({
      hits,
      reset_at:
        resetAt <= now
          ? new Date(now.getTime() + 60 * 60 * 1000).toISOString()
          : resetAt.toISOString(),
    }),
  })

  return hits <= limit
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin")
  const requestOrigin = new URL(request.url).origin

  if (origin !== APP_ORIGIN && origin !== requestOrigin) {
    return NextResponse.json(
      { error: "Please request a password reset from the Orbit website." },
      { status: 403 }
    )
  }

  try {
    const raw = await request.text()
    if (raw.length > 2048) {
      return NextResponse.json({ message: genericMessage })
    }

    const body = JSON.parse(raw)
    const email = String(body.email || "").trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
      return NextResponse.json({ message: genericMessage })
    }

    const resendKey = process.env.RESEND_API_KEY
    const from = process.env.RESEND_FROM_EMAIL
    const secret = process.env.SESSION_SECRET
    if (!resendKey || !from || !secret || secret.length < 32) {
      console.error("ORBIT_PASSWORD_RESET_NOT_CONFIGURED")
      return NextResponse.json({ message: genericMessage })
    }

    if (email === process.env.ADMIN_EMAIL?.trim().toLowerCase()) {
      return NextResponse.json({ message: genericMessage })
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown"
    const ipHash = createHmac("sha256", secret).update(ip).digest("hex")
    const emailHash = createHmac("sha256", secret).update(email).digest("hex")

    const ipAllowed = await consumeRate(`reset:ip:${ipHash}`, 10)
    const emailAllowed = await consumeRate(`reset:email:${emailHash}`, 3)
    if (!ipAllowed || !emailAllowed) {
      return NextResponse.json({ message: genericMessage })
    }

    const users = await db(
      `app_users?email=eq.${encodeURIComponent(email)}&select=id&limit=1`
    )
    const user = users?.[0] as { id?: string } | undefined

    if (!user?.id || OWNER_IDS.has(user.id)) {
      return NextResponse.json({ message: genericMessage })
    }

    const token = randomBytes(32).toString("hex")
    const hashedToken = tokenHash(token)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    // Reuse Orbit's existing protected one-time password token store. This
    // avoids depending on a newly-added PostgREST RPC schema-cache entry.
    await db("orbit_password_setup_tokens?on_conflict=user_id", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        user_id: user.id,
        token_hash: hashedToken,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      }),
    })

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Reset your Orbit LM password",
        text: `We received a request to reset your Orbit LM password.\n\nUse this one-time link:\n${APP_ORIGIN}/reset-password?token=${token}\n\nThis link expires in 30 minutes and can only be used once. If you did not request this, you can ignore this email.`,
      }),
    })

    if (!response.ok) {
      console.error(
        "ORBIT_PASSWORD_RESET_EMAIL_FAILED",
        response.status,
        await response.text()
      )
      await db(
        `orbit_password_setup_tokens?token_hash=eq.${encodeURIComponent(hashedToken)}`,
        { method: "DELETE" }
      ).catch(() => {})
    }

    return NextResponse.json({ message: genericMessage })
  } catch (error) {
    console.error("ORBIT_PASSWORD_RESET_REQUEST_FAILED:", error)
    return NextResponse.json({ message: genericMessage })
  }
}
