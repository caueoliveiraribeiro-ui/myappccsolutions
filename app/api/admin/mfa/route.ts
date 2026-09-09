import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createSession, getSession } from "@/lib/auth"
import { ownerAccountIds } from "@/lib/plan-access"
import { confirmMfa, createMfaSetup, mfaRecord } from "@/lib/admin-mfa"

async function owner() { const token = (await cookies()).get("orbit_session")?.value; const user = token ? await getSession(token) : null; return user && ownerAccountIds.has(user.id) ? user : null }
const responseSession = (user: { id: string; email: string }) => { const response = NextResponse.json({ ok: true }); response.cookies.set("orbit_session", createSession(user.email, user.id, true), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 43200 }); return response }

export async function GET() { const user = await owner(); if (!user) return NextResponse.json({ error: "Owner access required." }, { status: 403 }); const record = await mfaRecord(user.id); return NextResponse.json({ enabled: Boolean(record?.enabled_at), lastVerifiedAt: record?.last_verified_at || null }) }
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") && new URL(request.headers.get("origin")!).host !== request.nextUrl.host) return NextResponse.json({ error: "Invalid origin." }, { status: 403 })
  const user = await owner(); if (!user) return NextResponse.json({ error: "Owner access required." }, { status: 403 })
  const body = await request.json().catch(() => null) as { action?: string; code?: string } | null
  if (body?.action === "begin") { const setup = await createMfaSetup(user.id, user.email); return NextResponse.json(setup) }
  if (body?.action === "confirm" && await confirmMfa(user.id, String(body.code || ""))) return responseSession(user)
  return NextResponse.json({ error: "Enter a valid code from your authenticator app." }, { status: 400 })
}
