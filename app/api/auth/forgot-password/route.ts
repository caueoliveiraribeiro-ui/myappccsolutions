import { createHmac, randomBytes } from "node:crypto"
import { NextResponse } from "next/server"
import { db } from "@/lib/supabase"
import { tokenHash } from "@/lib/password-tokens"
import { APP_ORIGIN } from "@/lib/registration"

export const runtime = "nodejs"

const genericMessage = "If an Orbit account exists for this email, a password reset link has been sent."

export async function POST(request: Request) {
  const origin = request.headers.get("origin")
  const requestOrigin = new URL(request.url).origin

  if (origin !== APP_ORIGIN && origin !== requestOrigin) {
    return NextResponse.json({ error: "Please request a password reset from the Orbit website." }, { status: 403 })
  }

  try {
    const raw = await request.text()
    if (raw.length > 2048) return NextResponse.json({ message: genericMessage })

    const body = JSON.parse(raw)
    const email = String(body.email || "").trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return NextResponse.json({ message: genericMessage })

    const resendKey = process.env.RESEND_API_KEY
    const from = process.env.RESEND_FROM_EMAIL
    const secret = process.env.SESSION_SECRET
    if (!resendKey || !from || !secret || secret.length < 32) {
      console.error("ORBIT_PASSWORD_RESET_NOT_CONFIGURED")
      return NextResponse.json({ message: genericMessage })
    }

    if (email === process.env.ADMIN_EMAIL?.trim().toLowerCase()) return NextResponse.json({ message: genericMessage })

    const token = randomBytes(32).toString("hex")
    const hashedToken = tokenHash(token)
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    const ipHash = createHmac("sha256", secret).update(ip).digest("hex")

    const shouldSend = await db("rpc/orbit_password_reset_request", {
      method: "POST",
      body: JSON.stringify({ p_email: email, p_token_hash: hashedToken, p_ip_hash: ipHash }),
    })

    if (!shouldSend) return NextResponse.json({ message: genericMessage })

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
      console.error("ORBIT_PASSWORD_RESET_EMAIL_FAILED", response.status, await response.text())
      await db(`orbit_password_reset_tokens?token_hash=eq.${hashedToken}`, { method: "DELETE" }).catch(() => {})
    }

    return NextResponse.json({ message: genericMessage })
  } catch (error) {
    console.error("ORBIT_PASSWORD_RESET_REQUEST_FAILED:", error)
    return NextResponse.json({ message: genericMessage })
  }
}
