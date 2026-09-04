import { randomBytes } from "node:crypto"
import { db } from "@/lib/supabase"
import { hashUserPassword } from "@/lib/auth"
import { tokenHash } from "@/lib/registration"
import { sendAccountSetupEmail } from "@/lib/account-setup-email"

const offerPlans = {
  fcv6cun6: "personal",
  qks1vkpc: "small_business",
  n37sgoia: "big_business",
} as const

type HotmartPlan = (typeof offerPlans)[keyof typeof offerPlans]

type HotmartEvent = {
  id?: string
  event?: string
  creation_date?: number
  data?: any
}

async function alreadyProcessed(eventId: string) {
  const rows = await db(`orbit_hotmart_events?event_id=eq.${encodeURIComponent(eventId)}&select=event_id&limit=1`)
  return Boolean(rows?.[0])
}

async function markProcessed(eventId: string, eventType: string, transactionId?: string | null) {
  await db("orbit_hotmart_events", {
    method: "POST",
    body: JSON.stringify({
      event_id: eventId,
      event_type: eventType,
      transaction_id: transactionId || null,
    }),
  })
}

async function findOrbitUser(email: string) {
  const rows = await db(`app_users?email=eq.${encodeURIComponent(email)}&select=id,email,name&limit=1`)
  return rows?.[0] || null
}

async function provisionOrbitUser(email: string, name: string) {
  const setupToken = randomBytes(32).toString("hex")
  const placeholderPassword = randomBytes(48).toString("base64url")
  const password = hashUserPassword(placeholderPassword)

  const result = await db("rpc/orbit_stripe_provision_user", {
    method: "POST",
    body: JSON.stringify({
      p_email: email,
      p_name: name,
      p_password_salt: password.salt,
      p_password_hash: password.hash,
      p_token_hash: tokenHash(setupToken),
    }),
  })

  return {
    userId: result.user_id as string,
    created: Boolean(result.created),
    setupToken,
  }
}

function nextAccessDate(data: any) {
  const raw = Number(data?.purchase?.date_next_charge || data?.date_next_charge || 0)
  if (raw > Date.now()) return new Date(raw).toISOString()
  return new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString()
}

async function grantAccess(args: {
  userId: string
  subscriberCode: string | null
  offerCode: string
  plan: HotmartPlan
  paidUntil: string
  observedAt: string
}) {
  await db("orbit_hotmart_subscriptions?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      user_id: args.userId,
      subscriber_code: args.subscriberCode,
      offer_code: args.offerCode,
      plan: args.plan,
      status: "active",
      paid_until: args.paidUntil,
      observed_at: args.observedAt,
      updated_at: new Date().toISOString(),
    }),
  })

  await db("account_subscriptions?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      user_id: args.userId,
      plan: args.plan,
      status: "active",
      access_until: args.paidUntil,
      billing_provider: "hotmart",
      hotmart_subscriber_code: args.subscriberCode,
      hotmart_offer_code: args.offerCode,
      updated_at: new Date().toISOString(),
    }),
  })
}

async function revokeOrLimitHotmartAccess(subscriberCode: string | null, accessUntil: string | null, status: "canceled" | "inactive") {
  if (!subscriberCode) return

  const rows = await db(`orbit_hotmart_subscriptions?subscriber_code=eq.${encodeURIComponent(subscriberCode)}&select=user_id,plan,offer_code&limit=1`)
  const record = rows?.[0]
  if (!record?.user_id) return

  await db(`orbit_hotmart_subscriptions?user_id=eq.${encodeURIComponent(record.user_id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      status,
      paid_until: accessUntil,
      updated_at: new Date().toISOString(),
    }),
  })

  const activeUntil = accessUntil && new Date(accessUntil).getTime() > Date.now()
  const effectiveStatus = activeUntil ? "active" : status

  await db(`account_subscriptions?user_id=eq.${encodeURIComponent(record.user_id)}&billing_provider=eq.hotmart`, {
    method: "PATCH",
    body: JSON.stringify({
      status: effectiveStatus,
      access_until: accessUntil,
      updated_at: new Date().toISOString(),
    }),
  })
}

export async function processHotmartEvent(payload: HotmartEvent) {
  const eventId = String(payload.id || "").trim()
  const eventType = String(payload.event || "").trim()
  if (!eventId || !eventType) throw new Error("INVALID_HOTMART_EVENT")

  if (await alreadyProcessed(eventId)) return { duplicate: true }

  const data = payload.data || {}
  const purchase = data.purchase || {}
  const transactionId = purchase.transaction ? String(purchase.transaction) : null

  if (eventType === "PURCHASE_APPROVED" || eventType === "PURCHASE_COMPLETE") {
    const offerCode = String(purchase?.offer?.code || "").trim()
    const plan = offerPlans[offerCode as keyof typeof offerPlans]
    if (!plan) return { ignored: true, reason: "unknown_offer" }

    const email = String(data?.buyer?.email || "").trim().toLowerCase()
    const name = String(data?.buyer?.name || data?.buyer?.first_name || email.split("@")[0] || "Orbit User").trim()
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("MISSING_HOTMART_BUYER_EMAIL")

    let user = await findOrbitUser(email)
    let created = false
    let setupToken: string | null = null

    if (!user) {
      const provisioned = await provisionOrbitUser(email, name)
      user = { id: provisioned.userId, email, name }
      created = provisioned.created
      setupToken = provisioned.created ? provisioned.setupToken : null
    }

    const subscriberCode = data?.subscription?.subscriber?.code
      ? String(data.subscription.subscriber.code)
      : null
    const observedAt = payload.creation_date
      ? new Date(payload.creation_date).toISOString()
      : new Date().toISOString()
    const paidUntil = nextAccessDate(data)

    await grantAccess({
      userId: user.id,
      subscriberCode,
      offerCode,
      plan,
      paidUntil,
      observedAt,
    })

    if (created && setupToken) {
      await sendAccountSetupEmail(email, setupToken)
    }

    await markProcessed(eventId, eventType, transactionId)
    return { received: true, userId: user.id, created, plan }
  }

  if (["PURCHASE_REFUNDED", "PURCHASE_CHARGEBACK", "PURCHASE_CANCELED", "PURCHASE_EXPIRED"].includes(eventType)) {
    const subscriberCode = data?.subscription?.subscriber?.code
      ? String(data.subscription.subscriber.code)
      : null
    await revokeOrLimitHotmartAccess(subscriberCode, null, "canceled")
    await markProcessed(eventId, eventType, transactionId)
    return { received: true, revoked: true }
  }

  if (eventType === "SUBSCRIPTION_CANCELLATION") {
    const subscriberCode = data?.subscriber?.code ? String(data.subscriber.code) : null
    const rawUntil = Number(data?.date_next_charge || 0)
    const accessUntil = rawUntil > Date.now() ? new Date(rawUntil).toISOString() : null
    await revokeOrLimitHotmartAccess(subscriberCode, accessUntil, "canceled")
    await markProcessed(eventId, eventType, transactionId)
    return { received: true, canceled: true, accessUntil }
  }

  await markProcessed(eventId, eventType, transactionId)
  return { ignored: true }
}
