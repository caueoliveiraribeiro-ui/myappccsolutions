import { NextResponse } from "next/server"
import { checkPassword, createSession, OWNER_ID, verifyUserPassword } from "@/lib/auth"
import { db } from "@/lib/supabase"
import { verifyMfa } from "@/lib/admin-mfa"

const attempts = new Map<string, { count: number; reset: number }>()

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "local"
  const now = Date.now()
  const state = attempts.get(ip)
  if (state && state.reset > now && state.count >= 5) {
    return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 })
  }

  try {
    const body = await request.json()
    const email = String(body.email || "").trim().toLowerCase()
    const password = String(body.password || "")
    let id = ""
    let valid = false

    if (email === process.env.ADMIN_EMAIL?.toLowerCase()) {
      const override = await db(`orbit_owner_credentials?user_id=eq.${OWNER_ID}&select=password_salt,password_hash&limit=1`).catch(() => [])
      valid = override?.[0]
        ? verifyUserPassword(password, override[0].password_salt, override[0].password_hash)
        : checkPassword(password)
      if (valid) id = OWNER_ID
    } else {
      const users = await db(`app_users?email=eq.${encodeURIComponent(email)}&select=id,password_salt,password_hash&limit=1`)
      const user = users?.[0]
      if (user && verifyUserPassword(password, user.password_salt, user.password_hash)) {
        id = user.id
        valid = true
      }
    }

    if (!valid) {
      attempts.set(ip, { count: (state?.reset && state.reset > now ? state.count : 0) + 1, reset: now + 15 * 60 * 1000 })
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    let mfaVerified = false
    if (id === OWNER_ID) {
      const verification = await verifyMfa(id, String(body.mfa_code || "").trim())
      if (verification.required && !verification.valid) {
        return NextResponse.json({ error: "Enter the six-digit code from your authenticator app or a recovery code.", code: "MFA_REQUIRED" }, { status: 401 })
      }
      mfaVerified = verification.valid
    }

    attempts.delete(ip)
    const response = NextResponse.json({ ok: true })
    response.cookies.set("orbit_session", createSession(email, id, mfaVerified), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 43200,
    })
    return response
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
