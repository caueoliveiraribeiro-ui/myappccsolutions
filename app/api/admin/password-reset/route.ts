import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSession } from "@/lib/auth"
import { ownerAccountIds } from "@/lib/plan-access"
import { issuePasswordReset, resendEmailStatus, validEmail } from "@/lib/password-reset"

async function owner() {
  const token = (await cookies()).get("orbit_session")?.value
  const user = token ? await getSession(token) : null
  return user && ownerAccountIds.has(user.id) ? user : null
}

export async function POST(request: Request) {
  const actor = await owner()
  if (!actor) {
    return NextResponse.json({ error: "Owner access required." }, { status: 403 })
  }

  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 })
  }

  try {
    const raw = await request.text()
    if (raw.length > 2048) {
      return NextResponse.json({ error: "Invalid reset request." }, { status: 400 })
    }

    const body = JSON.parse(raw)
    const email = String(body.email || "").trim().toLowerCase()
    if (!validEmail(email)) {
      return NextResponse.json({ error: "Enter a valid Orbit account email." }, { status: 400 })
    }

    const result = await issuePasswordReset(email, { bypassPublicRate: true })
    if (result.ok) {
      let deliveryStatus: string | null = null
      if (result.resendId) {
        await new Promise((resolve) => setTimeout(resolve, 900))
        deliveryStatus = await resendEmailStatus(result.resendId)
      }

      if (["bounced", "complained", "suppressed", "canceled"].includes(deliveryStatus || "")) {
        console.error("ORBIT_ADMIN_PASSWORD_RESET_DELIVERY_FAILED:", result.resendId || "", deliveryStatus)
        return NextResponse.json(
          {
            error: `Resend accepted the reset email but its delivery status is ${deliveryStatus}. Check the recipient and Resend delivery details.`,
            resendId: result.resendId,
            deliveryStatus,
          },
          { status: 502 },
        )
      }

      const statusText = deliveryStatus ? ` Current Resend status: ${deliveryStatus}.` : ""
      return NextResponse.json({
        ok: true,
        message: `Password reset email accepted for ${result.email}.${statusText}`,
        resendId: result.resendId,
        deliveryStatus,
      })
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
      return NextResponse.json({ error: "Resend rejected the password-reset email. Check the server logs for details." }, { status: 502 })
    }
    if (result.code === "database_failed") {
      console.error("ORBIT_ADMIN_PASSWORD_RESET_DATABASE_FAILED:", result.detail || "")
      return NextResponse.json({ error: "The password-reset database tables are not available or could not be updated." }, { status: 503 })
    }

    console.error("ORBIT_ADMIN_PASSWORD_RESET_FAILED:", result.code, result.detail || "")
    return NextResponse.json({ error: "Password reset could not be issued." }, { status: 503 })
  } catch (error) {
    console.error("ORBIT_ADMIN_PASSWORD_RESET_FAILED:", error)
    return NextResponse.json({ error: "Password reset could not be issued." }, { status: 503 })
  }
}
