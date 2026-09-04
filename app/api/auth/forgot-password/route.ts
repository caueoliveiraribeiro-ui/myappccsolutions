import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSession } from "@/lib/auth"
import { ownerAccountIds } from "@/lib/plan-access"
import { APP_ORIGIN } from "@/lib/registration"
import { issuePasswordReset } from "@/lib/password-reset"

export const runtime = "nodejs"

const genericMessage =
  "If an Orbit account exists for this email, a password reset link has been sent."

async function currentOwner() {
  const token = (await cookies()).get("orbit_session")?.value
  const user = token ? await getSession(token) : null
  return user && ownerAccountIds.has(user.id) ? user : null
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
    if (raw.length > 2048) return NextResponse.json({ message: genericMessage })

    const body = JSON.parse(raw)
    const email = String(body.email || "")
    const owner = await currentOwner()

    if (owner) {
      const result = await issuePasswordReset(email, { bypassPublicRate: true })
      if (result.ok) {
        return NextResponse.json({ ok: true, message: `Password reset email sent to ${result.email}.` })
      }
      if (result.code === "not_found") {
        return NextResponse.json({ error: "Orbit account not found." }, { status: 404 })
      }
      if (result.code === "protected") {
        return NextResponse.json({ error: "Protected owner accounts cannot be reset from this panel." }, { status: 403 })
      }
      if (result.code === "not_configured") {
        return NextResponse.json({ error: "Password-reset email is not configured on the server." }, { status: 503 })
      }
      if (result.code === "email_failed") {
        console.error("ORBIT_ADMIN_PASSWORD_RESET_EMAIL_FAILED:", result.detail || "")
        return NextResponse.json({ error: "Resend rejected the password-reset email. Check Vercel logs for the delivery error." }, { status: 502 })
      }
      console.error("ORBIT_ADMIN_PASSWORD_RESET_FAILED:", result.code, result.detail || "")
      return NextResponse.json({ error: "Password reset could not be issued." }, { status: 503 })
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip")?.trim() ||
      "unknown"

    const result = await issuePasswordReset(email, { publicIp: ip })

    // Public password reset intentionally never reveals whether an account
    // exists, is owner-protected, is rate-limited, or had a delivery failure.
    if (!result.ok && !["not_found", "protected", "rate_limited"].includes(result.code)) {
      console.error("ORBIT_PASSWORD_RESET_REQUEST_FAILED:", result.code, result.detail || "")
    }

    return NextResponse.json({ message: genericMessage })
  } catch (error) {
    console.error("ORBIT_PASSWORD_RESET_REQUEST_FAILED:", error)
    return NextResponse.json({ message: genericMessage })
  }
}
