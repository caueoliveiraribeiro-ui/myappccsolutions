import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { checkPassword, getSession, hashUserPassword, OWNER_ID, verifyUserPassword } from "@/lib/auth"
import { db } from "@/lib/supabase"

export async function POST(request: Request) {
  const token = (await cookies()).get("orbit_session")?.value
  const user = token ? await getSession(token) : null
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 })

  try {
    const body = await request.json()
    const currentPassword = String(body?.currentPassword || "")
    const newPassword = String(body?.newPassword || "")
    if (newPassword.length < 12 || newPassword.length > 128) {
      return NextResponse.json({ error: "Use a new password between 12 and 128 characters." }, { status: 400 })
    }
    if (!currentPassword) return NextResponse.json({ error: "Enter your current password." }, { status: 400 })

    if (user.id === OWNER_ID) {
      const override = await db(`orbit_owner_credentials?user_id=eq.${OWNER_ID}&select=password_salt,password_hash&limit=1`).catch(() => [])
      const valid = override?.[0]
        ? verifyUserPassword(currentPassword, override[0].password_salt, override[0].password_hash)
        : checkPassword(currentPassword)
      if (!valid) return NextResponse.json({ error: "Your current password is incorrect." }, { status: 403 })

      const next = hashUserPassword(newPassword)
      await db("orbit_owner_credentials?on_conflict=user_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({ user_id: OWNER_ID, password_salt: next.salt, password_hash: next.hash, updated_at: new Date().toISOString() }),
      })
      return NextResponse.json({ ok: true })
    }

    const rows = await db(`app_users?id=eq.${encodeURIComponent(user.id)}&select=id,password_salt,password_hash&limit=1`)
    const account = rows?.[0]
    if (!account || !verifyUserPassword(currentPassword, account.password_salt, account.password_hash)) {
      return NextResponse.json({ error: "Your current password is incorrect." }, { status: 403 })
    }

    const next = hashUserPassword(newPassword)
    await db(`app_users?id=eq.${encodeURIComponent(user.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ password_salt: next.salt, password_hash: next.hash, updated_at: new Date().toISOString() }),
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Orbit password change failed", error)
    return NextResponse.json({ error: "We could not change your password right now." }, { status: 500 })
  }
}
