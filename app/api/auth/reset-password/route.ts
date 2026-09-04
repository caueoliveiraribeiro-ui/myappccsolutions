import { NextResponse } from "next/server"
import { hashUserPassword } from "@/lib/auth"
import { db } from "@/lib/supabase"
import { tokenHash } from "@/lib/password-tokens"
import { APP_ORIGIN } from "@/lib/registration"
import { ownerAccountIds } from "@/lib/plan-access"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const origin = request.headers.get("origin")
  const requestOrigin = new URL(request.url).origin

  if (origin !== APP_ORIGIN && origin !== requestOrigin) {
    return NextResponse.json({ error: "Please reset your password from the Orbit website." }, { status: 403 })
  }

  try {
    const raw = await request.text()
    if (raw.length > 4096) {
      return NextResponse.json({ error: "Invalid password reset request." }, { status: 400 })
    }

    const body = JSON.parse(raw)
    const token = String(body.token || "")
    const password = typeof body.password === "string" ? body.password : ""

    if (!/^[a-f0-9]{64}$/.test(token) || password.length < 12 || password.length > 128) {
      return NextResponse.json(
        { error: "Use a valid reset link and a password between 12 and 128 characters." },
        { status: 400 }
      )
    }

    const hashedToken = tokenHash(token)
    const now = new Date().toISOString()

    // Atomically consume exactly one unexpired token from the same table used
    // by forgot-password, admin resets, and Stripe-created account setup.
    const consumed = await db(
      `orbit_password_setup_tokens?token_hash=eq.${encodeURIComponent(hashedToken)}&expires_at=gt.${encodeURIComponent(now)}&select=user_id`,
      { method: "DELETE" }
    )

    const targetUser = consumed?.[0]?.user_id as string | undefined
    if (!targetUser || ownerAccountIds.has(targetUser)) {
      return NextResponse.json(
        { error: "This reset link is invalid, expired, or has already been used." },
        { status: 400 }
      )
    }

    const hashed = hashUserPassword(password)
    const updated = await db(`app_users?id=eq.${encodeURIComponent(targetUser)}&select=id`, {
      method: "PATCH",
      body: JSON.stringify({
        password_salt: hashed.salt,
        password_hash: hashed.hash,
      }),
    })

    if (!updated?.[0]?.id) {
      throw new Error("ORBIT_PASSWORD_RESET_USER_UPDATE_FAILED")
    }

    const response = NextResponse.json({ ok: true })
    response.cookies.set("orbit_session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    })
    return response
  } catch (error) {
    console.error("ORBIT_PASSWORD_RESET_FAILED:", error)
    return NextResponse.json(
      { error: "Your password could not be reset right now. Please try again." },
      { status: 503 }
    )
  }
}
