import { randomBytes } from "node:crypto"
import Stripe from "stripe"
import { db } from "@/lib/supabase"
import { hashUserPassword } from "@/lib/auth"
import { tokenHash } from "@/lib/registration"
import {
  isSubscriptionPlan,
  planForStripePrice,
} from "@/lib/stripe-plans"
import { getStripe } from "@/lib/stripe"

function stripeId(
  value: string | Stripe.Customer | Stripe.Subscription | null | undefined,
  prefix: string
) {
  if (!value) return null

  const raw =
    typeof value === "string"
      ? value
      : value.id

  return raw.startsWith(prefix) ? raw : null
}

async function subscriptionSnapshot(subscriptionId: string) {
  const stripe = getStripe()

  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  })
}

function subscriptionPlan(subscription: Stripe.Subscription) {
  if (subscription.items.data.length !== 1) {
    return null
  }

  const item = subscription.items.data[0]

  if (item.quantity !== 1) {
    return null
  }

  const priceId =
    typeof item.price === "string"
      ? item.price
      : item.price.id

  const plan = planForStripePrice(priceId)

  if (!plan || !isSubscriptionPlan(plan)) {
    return null
  }

  return plan
}

function paidUntil(subscription: Stripe.Subscription) {
  const value = subscription.current_period_end

  if (!value) return null

  return new Date(value * 1000).toISOString()
}

async function provisionOrbitUser(
  email: string,
  name: string
) {
  const setupToken = randomBytes(32).toString("hex")
  const placeholderPassword = randomBytes(48).toString("base64url")
  const password = hashUserPassword(placeholderPassword)

  const result = await db(
    "rpc/orbit_stripe_provision_user",
    {
      method: "POST",
      body: JSON.stringify({
        p_email: email,
        p_name: name,
        p_password_salt: password.salt,
        p_password_hash: password.hash,
        p_token_hash: tokenHash(setupToken),
      }),
    }
  )

  return {
    userId: result.user_id as string,
    created: Boolean(result.created),
    setupToken,
  }
}

async function bindSubscription(args: {
  userId: string
  subscriptionId: string
  customerId: string
  plan: string
  observed: string
}) {
  return db(
    "rpc/orbit_stripe_bind_subscription",
    {
      method: "POST",
      body: JSON.stringify({
        p_user: args.userId,
        p_subscription: args.subscriptionId,
        p_customer: args.customerId,
        p_plan: args.plan,
        p_observed: args.observed,
      }),
    }
  )
}

async function applySubscription(args: {
  eventId: string
  observed: string
  userId: string
  subscriptionId: string
  customerId: string
  plan: string
  status: string
  paidUntil: string | null
  paid: boolean
}) {
  return db(
    "rpc/orbit_apply_stripe_event",
    {
      method: "POST",
      body: JSON.stringify({
        p_event: args.eventId,
        p_observed: args.observed,
        p_user: args.userId,
        p_subscription: args.subscriptionId,
        p_customer: args.customerId,
        p_plan: args.plan,
        p_status: args.status,
        p_paid_until: args.paidUntil,
        p_paid: args.paid,
      }),
    }
  )
}

async function findOrbitUserByEmail(email: string) {
  const rows = await db(
    `app_users?email=eq.${encodeURIComponent(email)}&select=id,email,name&limit=1`
  )

  return rows?.[0] ?? null
}

async function handleCheckoutCompleted(
  event: Stripe.Event,
  session: Stripe.Checkout.Session
) {
  if (session.mode !== "subscription") {
    return { ignored: true }
  }

  const subscriptionId = stripeId(
    session.subscription,
    "sub_"
  )

  const customerId = stripeId(
    session.customer,
    "cus_"
  )

  if (!subscriptionId || !customerId) {
    throw new Error("INVALID_STRIPE_CHECKOUT_BINDING")
  }

  const email =
    session.customer_details?.email?.trim().toLowerCase() ||
    session.customer_email?.trim().toLowerCase()

  if (!email) {
    throw new Error("MISSING_CUSTOMER_EMAIL")
  }

  const subscription =
    await subscriptionSnapshot(subscriptionId)

  const plan = subscriptionPlan(subscription)

  if (!plan) {
    throw new Error("INVALID_STRIPE_SUBSCRIPTION_PLAN")
  }

  const observed =
    new Date(event.created * 1000).toISOString()

  let userId =
    typeof session.metadata?.orbit_user_id === "string"
      ? session.metadata.orbit_user_id
      : null

  let created = false
  let setupToken: string | null = null

  if (userId) {
    const rows = await db(
      `app_users?id=eq.${encodeURIComponent(userId)}&select=id,email&limit=1`
    )

    const existing = rows?.[0]

    if (!existing) {
      throw new Error("ORBIT_USER_NOT_FOUND")
    }

    if (
      String(existing.email).trim().toLowerCase() !== email
    ) {
      throw new Error("ORBIT_EMAIL_MISMATCH")
    }
  } else {
    const existing = await findOrbitUserByEmail(email)

    if (existing) {
      userId = existing.id
    } else {
      const name =
        session.customer_details?.name?.trim() ||
        email.split("@")[0]

      const provisioned =
        await provisionOrbitUser(email, name)

      userId = provisioned.userId
      created = provisioned.created
      setupToken = provisioned.created
        ? provisioned.setupToken
        : null
    }
  }

  await bindSubscription({
    userId,
    subscriptionId,
    customerId,
    plan,
    observed,
  })

  // Checkout completion alone binds the subscription.
  // Access is granted only from a paid Stripe lifecycle event.
  return {
    received: true,
    userId,
    created,
    setupTokenCreated: Boolean(setupToken),
  }
}

async function handleSubscriptionEvent(
  event: Stripe.Event,
  subscription: Stripe.Subscription,
  paid: boolean
) {
  const plan = subscriptionPlan(subscription)

  if (!plan) {
    return { ignored: true }
  }

  const subscriptionId = subscription.id

  const customerId = stripeId(
    subscription.customer,
    "cus_"
  )

  if (!customerId) {
    throw new Error("INVALID_STRIPE_CUSTOMER")
  }

  const metadataUserId =
    subscription.metadata?.orbit_user_id

  let userId =
    typeof metadataUserId === "string" &&
    metadataUserId
      ? metadataUserId
      : null

  if (!userId) {
    const rows = await db(
      `orbit_stripe_subscriptions?subscription_id=eq.${encodeURIComponent(subscriptionId)}&select=user_id&limit=1`
    )

    userId = rows?.[0]?.user_id || null
  }

if (!userId) {
  throw new Error("RETRY_UNBOUND_STRIPE_SUBSCRIPTION")
}

  return applySubscription({
    eventId: event.id,
    observed: new Date(
      event.created * 1000
    ).toISOString(),
    userId,
    subscriptionId,
    customerId,
    plan,
    status: subscription.status,
    paidUntil: paid
      ? paidUntil(subscription)
      : null,
    paid,
  })
}

export async function processStripeEvent(
  event: Stripe.Event
) {
  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutCompleted(
        event,
        event.data.object as Stripe.Checkout.Session
      )

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return handleSubscriptionEvent(
        event,
        event.data.object as Stripe.Subscription,
        false
      )

    case "invoice.paid": {
      const invoice =
        event.data.object as Stripe.Invoice

      const subscriptionId = stripeId(
        invoice.subscription,
        "sub_"
      )

      if (!subscriptionId) {
        return { ignored: true }
      }

      const subscription =
        await subscriptionSnapshot(subscriptionId)

      return handleSubscriptionEvent(
        event,
        subscription,
        true
      )
    }

    case "invoice.payment_failed": {
      const invoice =
        event.data.object as Stripe.Invoice

      const subscriptionId = stripeId(
        invoice.subscription,
        "sub_"
      )

      if (!subscriptionId) {
        return { ignored: true }
      }

      const subscription =
        await subscriptionSnapshot(subscriptionId)

      return handleSubscriptionEvent(
        event,
        subscription,
        false
      )
    }

    default:
      return { ignored: true }
  }
}