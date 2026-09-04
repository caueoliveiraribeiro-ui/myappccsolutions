import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getStripe, ORBIT_ORIGIN } from "@/lib/stripe"

export const runtime = "nodejs"

export async function POST(req: Request) {
  if (req.headers.get("origin") !== ORBIT_ORIGIN) {
    return NextResponse.json(
      { error: "Please open billing inside Orbit." },
      { status: 403 }
    )
  }

  const token = (await cookies()).get("orbit_session")?.value
  const user = token ? await getSession(token) : null

  if (!user) {
    return NextResponse.json(
      { error: "Please sign in." },
      { status: 401 }
    )
  }

  try {
    const stripe = getStripe()

    const customers = await stripe.customers.list({
      email: user.email,
      limit: 10,
    })

    let customerId: string | null = null

    for (const customer of customers.data) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: "all",
        limit: 10,
      })

      const orbitSubscription = subscriptions.data.find(
        (subscription) =>
          subscription.metadata.orbit_user_id === user.id
      )

      if (orbitSubscription) {
        customerId = customer.id
        break
      }
    }

    if (!customerId) {
      return NextResponse.json(
        {
          error:
            "No Stripe subscription is linked to your Orbit account yet.",
        },
        { status: 404 }
      )
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: ORBIT_ORIGIN + "/billing",
    })

    return NextResponse.json({
      url: session.url,
    })
  } catch (error) {
    console.error("STRIPE_PORTAL_FAILED:", error)

    return NextResponse.json(
      {
        error:
          "Billing management is temporarily unavailable. Please try again.",
      },
      { status: 503 }
    )
  }
}