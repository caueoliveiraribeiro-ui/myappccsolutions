import { NextResponse } from "next/server"
import { APP_ORIGIN } from "@/lib/registration"
import { issuePasswordReset } from "@/lib/password-reset"

export const runtime = "nodejs"

const genericMessage =
  "If an Orbit account exists for this email, a password reset link has been sent."

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
