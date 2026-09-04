import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSession } from "@/lib/auth"
import { ownerAccountIds } from "@/lib/plan-access"
import { db } from "@/lib/supabase"

async function owner() {
  const token = (await cookies()).get("orbit_session")?.value
  const user = token ? await getSession(token) : null
  return user && ownerAccountIds.has(user.id) ? user : null
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function cleanSearch(value: string) {
  return value.trim().slice(0, 120).replace(/[(),]/g, " ")
}

export async function GET(request: Request) {
  if (!(await owner())) {
    return NextResponse.json({ error: "Owner access required." }, { status: 403 })
  }

  try {
    const url = new URL(request.url)
    const q = cleanSearch(url.searchParams.get("q") || "")
    const plan = String(url.searchParams.get("plan") || "all")
    const status = String(url.searchParams.get("status") || "all")
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1)
    const pageSize = Math.min(50, Math.max(10, Number.parseInt(url.searchParams.get("pageSize") || "25", 10) || 25))
    const offset = (page - 1) * pageSize

    let userResource = `app_users?select=id,name,email&order=email.asc&limit=${pageSize + 1}&offset=${offset}`

    if (q) {
      if (uuidPattern.test(q)) {
        userResource = `app_users?select=id,name,email&id=eq.${encodeURIComponent(q)}&limit=${pageSize + 1}&offset=${offset}`
      } else {
        const pattern = encodeURIComponent(`*${q}*`)
        userResource = `app_users?select=id,name,email&or=(name.ilike.${pattern},email.ilike.${pattern})&order=email.asc&limit=${pageSize + 1}&offset=${offset}`
      }
    }

    const rawUsers = (await db(userResource)) || []
    const hasMore = rawUsers.length > pageSize
    const users = rawUsers.slice(0, pageSize)
    const ids = users.map((u: { id: string }) => u.id)

    let subscriptions: any[] = []
    if (ids.length) {
      subscriptions =
        (await db(
          `account_subscriptions?user_id=in.(${ids.join(",")})&select=user_id,plan,status,access_until,stripe_customer_id,stripe_subscription_id,updated_at`
        )) || []
    }

    const byUser = new Map(subscriptions.map((row: any) => [row.user_id, row]))
    const now = Date.now()

    let rows = users.map((user: any) => {
      if (ownerAccountIds.has(user.id)) {
        return {
          ...user,
          isOwner: true,
          plan: "owner",
          status: "active",
          accessUntil: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          updatedAt: null,
        }
      }

      const sub = byUser.get(user.id)
      const expired =
        sub?.status === "active" &&
        sub?.access_until &&
        new Date(sub.access_until).getTime() <= now

      return {
        ...user,
        isOwner: false,
        plan: sub?.plan || "none",
        status: expired ? "expired" : sub?.status || "unassigned",
        accessUntil: sub?.access_until || null,
        stripeCustomerId: sub?.stripe_customer_id || null,
        stripeSubscriptionId: sub?.stripe_subscription_id || null,
        updatedAt: sub?.updated_at || null,
      }
    })

    if (plan !== "all") rows = rows.filter((row: any) => row.plan === plan)
    if (status !== "all") rows = rows.filter((row: any) => row.status === status)

    const allUsers = (await db("app_users?select=id&limit=1000")) || []
    const allSubs =
      (await db("account_subscriptions?select=user_id,plan,status,access_until&limit=1000")) || []
    const ownerCount = allUsers.filter((u: any) => ownerAccountIds.has(u.id)).length
    const activePaid = allSubs.filter(
      (s: any) =>
        s.status === "active" &&
        s.access_until &&
        new Date(s.access_until).getTime() > now &&
        ["personal", "small_business", "big_business"].includes(s.plan)
    ).length
    const pastDue = allSubs.filter((s: any) => s.status === "past_due").length
    const canceled = allSubs.filter((s: any) => s.status === "canceled").length

    return NextResponse.json({
      users: rows,
      page,
      hasMore,
      metrics: {
        totalAccounts: allUsers.length,
        activePaid,
        noPlan: Math.max(0, allUsers.length - ownerCount - activePaid),
        pastDue,
        canceled,
      },
    })
  } catch (error) {
    console.error("ORBIT_ADMIN_USERS_FAILED:", error)
    return NextResponse.json({ error: "Could not load Orbit accounts." }, { status: 503 })
  }
}

async function optionalRows(resource: string) {
  try {
    return (await db(resource)) || []
  } catch {
    return []
  }
}

async function optionalDelete(resource: string) {
  try {
    await db(resource, { method: "DELETE" })
  } catch {
    // Optional provider/profile tables may not exist in older databases.
  }
}

export async function DELETE(request: Request) {
  if (!(await owner())) {
    return NextResponse.json({ error: "Owner access required." }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => null)
    const userId = String(body?.userId || "").trim()
    const confirmEmail = String(body?.confirmEmail || "").trim().toLowerCase()

    if (!uuidPattern.test(userId)) {
      return NextResponse.json({ error: "Invalid Orbit user ID." }, { status: 400 })
    }
    if (ownerAccountIds.has(userId)) {
      return NextResponse.json({ error: "Protected owner accounts cannot be deleted." }, { status: 403 })
    }

    const users = (await db(`app_users?id=eq.${encodeURIComponent(userId)}&select=id,email,name&limit=1`)) || []
    const target = users[0]
    if (!target) {
      return NextResponse.json({ error: "Orbit account not found." }, { status: 404 })
    }
    if (!confirmEmail || confirmEmail !== String(target.email || "").trim().toLowerCase()) {
      return NextResponse.json({ error: "Type the user's exact email address to confirm deletion." }, { status: 400 })
    }

    const [accountRows, stripeRows, paddleRows, hotmartRows] = await Promise.all([
      optionalRows(`account_subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=status,plan`),
      optionalRows(`orbit_stripe_subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=status,subscription_id`),
      optionalRows(`orbit_paddle_subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=status,subscription_id`),
      optionalRows(`orbit_hotmart_subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=status,subscriber_code`),
    ])

    const accountBlocks = accountRows.some((row: any) => ["active", "past_due"].includes(String(row.status || "").toLowerCase()))
    const providerBlocks = [...stripeRows, ...paddleRows, ...hotmartRows].some((row: any) => {
      const state = String(row.status || "").toLowerCase()
      return state && !["canceled", "cancelled", "inactive", "incomplete_expired", "expired", "refunded"].includes(state)
    })

    if (accountBlocks || providerBlocks) {
      return NextResponse.json(
        {
          error:
            "This user still has an active or unresolved billing subscription. Cancel or resolve the subscription first, then delete the Orbit account so external billing is not orphaned.",
        },
        { status: 409 },
      )
    }

    const id = encodeURIComponent(userId)
    const email = encodeURIComponent(String(target.email || ""))

    // Remove user-owned Orbit data before the identity itself. Holdings must go
    // before portfolios because holdings can reference a portfolio.
    for (const table of [
      "holdings",
      "payment_records",
      "tasks",
      "activities",
      "projects",
      "clients",
      "leads",
      "expenses",
      "grocery_items",
      "assets",
      "portfolios",
    ]) {
      await db(`${table}?user_id=eq.${id}`, { method: "DELETE" })
    }

    await optionalDelete(`workspace_members?member_user_id=eq.${id}`)
    await optionalDelete(`workspace_members?owner_user_id=eq.${id}`)
    await optionalDelete(`workspace_invites?owner_user_id=eq.${id}`)
    await optionalDelete(`workspace_invites?email=ilike.${email}`)
    await optionalDelete(`gmail_connections?user_id=eq.${id}`)
    await optionalDelete(`calendar_connections?user_id=eq.${id}`)
    await optionalDelete(`user_profiles?user_id=eq.${id}`)
    await optionalDelete(`orbit_password_setup_tokens?user_id=eq.${id}`)
    await optionalDelete(`orbit_paddle_checkouts?user_id=eq.${id}`)
    await optionalDelete(`orbit_paddle_subscriptions?user_id=eq.${id}`)
    await optionalDelete(`orbit_stripe_subscriptions?user_id=eq.${id}`)
    await optionalDelete(`orbit_hotmart_subscriptions?user_id=eq.${id}`)
    await optionalDelete(`account_subscriptions?user_id=eq.${id}`)

    await db(`app_users?id=eq.${id}`, { method: "DELETE" })

    return NextResponse.json({ ok: true, deletedUserId: userId })
  } catch (error) {
    console.error("ORBIT_ADMIN_USER_DELETE_FAILED:", error)
    return NextResponse.json(
      { error: "Could not delete this Orbit account. No owner account was changed." },
      { status: 503 },
    )
  }
}
