import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSession } from "@/lib/auth"
import { accountAccess, ownerAccountIds } from "@/lib/plan-access"
import { db } from "@/lib/supabase"

async function owner() {
  const token = (await cookies()).get("orbit_session")?.value
  const user = token ? await getSession(token) : null
  return user && ownerAccountIds.has(user.id) ? user : null
}

function emailValid(email: string) {
  return email.length <= 254 && /^\S+@\S+\.\S+$/.test(email)
}

export async function GET(request: Request) {
  if (!(await owner())) {
    return NextResponse.json({ error: "Owner access required." }, { status: 403 })
  }

  const email = (new URL(request.url).searchParams.get("email") || "").trim().toLowerCase()
  if (!emailValid(email)) {
    return NextResponse.json({ error: "Enter a valid account email." }, { status: 400 })
  }

  try {
    const users = await db(
      `app_users?email=eq.${encodeURIComponent(email)}&select=id,name,email&limit=1`
    )
    if (!users?.[0]) {
      return NextResponse.json({ error: "Orbit account not found." }, { status: 404 })
    }
    return NextResponse.json({ user: users[0], access: await accountAccess(users[0].id) })
  } catch (error) {
    console.error("ORBIT_ADMIN_ACCOUNT_LOOKUP_FAILED:", error)
    return NextResponse.json({ error: "Could not look up this account." }, { status: 503 })
  }
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
    const text = await request.text()
    if (text.length > 4096) throw Error("INPUT")

    const body = JSON.parse(text)
    const email = String(body.email || "").trim().toLowerCase()
    const until = body.accessUntil ? new Date(body.accessUntil) : null

    if (
      !emailValid(email) ||
      !["personal", "small_business", "big_business"].includes(body.plan) ||
      !["active", "inactive", "past_due", "canceled"].includes(body.status) ||
      (body.status === "active" &&
        (!until || !Number.isFinite(until.getTime()) || until.getTime() <= Date.now()))
    ) {
      return NextResponse.json(
        { error: "Choose a plan, status, and a future access expiration date for active access." },
        { status: 400 }
      )
    }

    const users = await db(
      `app_users?email=eq.${encodeURIComponent(email)}&select=id&limit=1`
    )
    const id = users?.[0]?.id
    if (!id) {
      return NextResponse.json({ error: "Orbit account not found." }, { status: 404 })
    }
    if (ownerAccountIds.has(id)) {
      return NextResponse.json(
        { error: "Owner access is protected and cannot be changed here." },
        { status: 403 }
      )
    }

    await db("rpc/orbit_assign_plan", {
      method: "POST",
      body: JSON.stringify({
        p_actor: actor.id,
        p_target: id,
        p_plan: body.plan,
        p_status: body.status,
        p_until: until && Number.isFinite(until.getTime()) ? until.toISOString() : null,
      }),
    })

    return NextResponse.json({ ok: true, access: await accountAccess(id) })
  } catch (error) {
    console.error("ORBIT_ADMIN_ACCESS_SAVE_FAILED:", error)
    return NextResponse.json(
      { error: "The assignment could not be saved. Please check the details and try again." },
      { status: 503 }
    )
  }
}
