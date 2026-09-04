import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { ownerAccountIds } from "@/lib/plan-access"
import { getStripe, ORBIT_ORIGIN, stripeBillingReady } from "@/lib/stripe"
import {
  isStripePlan,
  isSubscriptionPlan,
  stripeOffers,
} from "@/lib/stripe-plans"

export const runtime = "nodejs"

export async function POST(req: Request) {
  if (req.headers.get("origin") !== ORBIT_ORIGIN) {
    return NextResponse.json(
      { error: "Please start checkout inside Orbit." },
      { status: 403 }
    )
  }

  // Login is now OPTIONAL.
  // Existing users are recognized, but new customers can checkout without an account.
  const token = (await cookies()).get("orbit_session")?.value
  const user = token ? await getSession(token) : null

  if (user && ownerAccountIds.has(user.id)) {
    return NextResponse.json(
      {
        error:
          "Your owner account already has full access. No subscription is needed.",
      },
      { status: 409 }
    )
  }

  if (!stripeBillingReady()) {
    return NextResponse.json(
      {
        error:
          "Subscriptions are not open yet. No payment has been taken.",
      },
      { status: 503 }
    )
  }

  try {
    const body: { plan: unknown } = await req.json()

    if (!isStripePlan(body.plan)) {
      return NextResponse.json(
        {
          error:
            "Choose a Personal, Small Business, Big Business or Business Customization plan.",
        },
        { status: 400 }
      )
    }

    const stripe = getStripe()
    const offer = stripeOffers[body.plan]

    const price = await stripe.prices.retrieve(offer.priceId)

    if (!price.active || !price.currency) {
      return NextResponse.json(
        {
          error:
            "This offer needs a billing configuration check. No payment has been taken.",
        },
        { status: 503 }
      )
    }

    if (isSubscriptionPlan(body.plan)) {
      if (
        price.type !== "recurring" ||
        price.recurring?.interval !== "month" ||
        price.recurring?.interval_count !== 1
      ) {
        return NextResponse.json(
          {
            error:
              "This subscription price is not configured as a monthly recurring payment.",
          },
          { status: 503 }
        )
      }
    } else {
      if (price.type !== "one_time") {
        return NextResponse.json(
          {
            error:
              "Business Customization must use a one-time Stripe price.",
          },
          { status: 503 }
        )
      }
    }

    const mode = isSubscriptionPlan(body.plan)
      ? "subscription"
      : "payment"

    const baseMetadata: Record<string, string> = {
      orbit_plan: body.plan,
      orbit_payment_type: mode,
    }

    // If already logged in, bind checkout to the existing Orbit account.
    if (user) {
      baseMetadata.orbit_user_id = user.id
    }

    const session = await stripe.checkout.sessions.create({
      mode,

      // Existing users get their email pre-filled.
      // New users enter their email directly in Stripe Checkout.
      ...(user
        ? {
            customer_email: user.email,
            client_reference_id: user.id,
          }
        : {}),

      line_items: [
        {
          price: offer.priceId,
          quantity: 1,
        },
      ],

      metadata: baseMetadata,

      ...(mode === "subscription"
        ? {
            subscription_data: {
              metadata: baseMetadata,
            },
          }
        : {
            payment_intent_data: {
              metadata: baseMetadata,
            },
          }),

      success_url:
        ORBIT_ORIGIN +
        "/subscribe?checkout=success&plan=" +
        encodeURIComponent(body.plan) +
        "&session_id={CHECKOUT_SESSION_ID}",

      cancel_url:
        ORBIT_ORIGIN +
        "/subscribe?checkout=cancelled&plan=" +
        encodeURIComponent(body.plan),
    })

    if (!session.url) {
      throw new Error("STRIPE_CHECKOUT_URL_MISSING")
    }

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    })
  } catch (error) {
    console.error("STRIPE_CHECKOUT_FAILED:", error)

    return NextResponse.json(
      {
        error:
          "Checkout could not be prepared. Please try again later; do not submit another payment if you already paid.",
      },
      { status: 503 }
    )
  }
}