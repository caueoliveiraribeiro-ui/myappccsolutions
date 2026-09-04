import { NextResponse } from "next/server"
import { hashUserPassword } from "@/lib/auth"
import { db } from "@/lib/supabase"
import { APP_ORIGIN } from "@/lib/registration"
import { tokenHash } from "@/lib/password-tokens"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const origin = request.headers.get("origin")
  const requestOrigin = new URL(request.url).origin

  if (origin !== APP_ORIGIN && origin !== requestOrigin) {
    return NextResponse.json({ error: "Please set your password from the Orbit website." }, { status: 403 })
  }

  try {
    const raw = await request.text()
    if (raw.length > 2048) return NextResponse.json({ error: "Invalid password setup request." }, { status: 400 })

    const body = JSON.parse(raw)
    const token = String(body.token || "")
    const password = typeof body.password === "string" ? body.password : ""

    if (!/^[a-f0-9]{64}$/.test(token) || password.length < 12 || password.length > 128) {
      return NextResponse.json({ error: "Use a valid setup link and a password between 12 and 128 characters." }, { status: 400 })
    }

    const hashed = hashUserPassword(password)
    const changed = await db("rpc/orbit_stripe_set_password", {
      method: "POST",
      body: JSON.stringify({ p_token_hash: tokenHash(token), p_password_salt: hashed.salt, p_password_hash: hashed.hash }),
    })

    if (!changed) return NextResponse.json({ error: "This password setup link is invalid, expired, or has already been used." }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("ORBIT_SET_PASSWORD_FAILED:", error)
    return NextResponse.json({ error: "Your password could not be saved right now. Please try again." }, { status: 503 })
  }
}
