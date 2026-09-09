import { randomBytes } from "node:crypto"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSession } from "@/lib/auth"
import { requestFeature } from "@/lib/plan-access"
import { db } from "@/lib/supabase"
import { APP_ORIGIN } from "@/lib/registration"

const inviteCheckout = "https://pay.hotmart.com/U107532997T?off=l697xvib"
const clean = (value: unknown) => String(value || "").replace(/[<>]/g, "").slice(0, 1000)

async function currentUser() {
  const token = (await cookies()).get("orbit_session")?.value
  return token ? getSession(token) : null
}

function inviteUrl(token: string) {
  return `${APP_ORIGIN}/invite/${token}`
}

async function sendCheckoutInvitation(args: {
  email: string
  recipientName: string
  senderName: string
  message: string
  permission: "editor" | "viewer"
  token: string
}) {
  const key = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!key || !from) throw new Error("INVITATION_EMAIL_NOT_CONFIGURED")

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      from,
      to: [args.email],
      reply_to: process.env.RESEND_REPLY_TO_EMAIL || undefined,
      subject: `${args.senderName} invited you to share their Orbit LM workspace`,
      text: `Hi ${args.recipientName},\n\n${args.senderName} invited you to their Orbit LM workspace with ${args.permission === "editor" ? "editing" : "view-only"} access.\n\n${args.message}\n\nTo activate your own secure login and join their workspace, start the US$12.99/month shared-access subscription here:\n${inviteUrl(args.token)}\n\nAfter Hotmart confirms payment, we will email you a one-time link to create your password. Do not share this invitation link.`,
    }),
  })
  if (!response.ok) throw new Error(`INVITATION_EMAIL_FAILED:${response.status}`)
}

export async function GET() {
  const denied = await requestFeature("invitations")
  if (denied) return denied
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Your session expired." }, { status: 401 })

  try {
    const invites = await db(`workspace_invites?owner_user_id=eq.${encodeURIComponent(user.id)}&select=*&order=created_at.desc`)
    return NextResponse.json({ invites })
  } catch {
    return NextResponse.json({ error: "Shared access is not configured yet." }, { status: 503 })
  }
}

export async function POST(request: Request) {
  const denied = await requestFeature("invitations")
  if (denied) return denied
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Your session expired." }, { status: 401 })

  try {
    const body = await request.json()
    const email = clean(body.email).trim().toLowerCase()
    const permission = body.permission === "viewer" ? "viewer" : "editor"
    const relationship = ["Parent", "Family", "Friend", "Employee", "Partner"].includes(body.relationship) ? body.relationship : "Friend"
    const senderName = clean(body.senderName) || user.email
    const recipientName = clean(body.recipientName) || "there"
    const message = clean(body.message)

    if (!/^\S+@\S+\.\S+$/.test(email) || email === user.email.toLowerCase()) {
      return NextResponse.json({ error: "Enter another person's valid email." }, { status: 400 })
    }

    const existing = await db(`workspace_invites?email=eq.${encodeURIComponent(email)}&status=eq.awaiting_payment&select=id,owner_user_id&limit=1`)
    if (existing?.[0] && existing[0].owner_user_id !== user.id) {
      return NextResponse.json({ error: "This email already has a secure invitation awaiting payment. Ask the recipient to complete or cancel that invitation first." }, { status: 409 })
    }

    const token = randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const rows = await db("workspace_invites?on_conflict=owner_user_id,email", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        owner_user_id: user.id,
        email,
        recipient_name: recipientName,
        relationship,
        permission,
        status: "awaiting_payment",
        checkout_token: token,
        checkout_expires_at: expiresAt,
        paid_at: null,
        member_user_id: null,
        hotmart_subscriber_code: null,
      }),
    })
    const invite = rows?.[0]
    if (!invite?.id) throw new Error("INVITE_SAVE_FAILED")

    await sendCheckoutInvitation({ email, recipientName, senderName, message, permission, token })
    const checkout = new URL(inviteCheckout)
    checkout.searchParams.set("email", email)
    checkout.searchParams.set("name", recipientName)
    checkout.searchParams.set("sck", token)

    return NextResponse.json({ ok: true, status: "awaiting_payment", inviteUrl: inviteUrl(token), checkoutUrl: checkout.toString() })
  } catch (error) {
    console.error("ORBIT_INVITATION_CREATE_FAILED", { message: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: "We could not prepare this secure invitation. Please try again." }, { status: 503 })
  }
}
