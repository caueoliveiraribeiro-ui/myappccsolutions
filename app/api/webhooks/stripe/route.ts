import { NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe"
import { processStripeEvent } from "@/lib/stripe-webhook"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!secret) {
    return NextResponse.json(
      { error: "Stripe webhook is not configured." },
      { status: 503 }
    )
  }

  const contentLength = Number(
    req.headers.get("content-length") || 0
  )

  if (contentLength > 1048576) {
    return new NextResponse(null, { status: 413 })
  }

  const raw = await req.text()

  if (Buffer.byteLength(raw) > 1048576) {
    return new NextResponse(null, { status: 413 })
  }

  const signature = req.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature." },
      { status: 401 }
    )
  }

  try {
    const stripe = getStripe()

    const event = stripe.webhooks.constructEvent(
      raw,
      signature,
      secret
    )

    const result = await processStripeEvent(event)

    return NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error)

    console.error("STRIPE_WEBHOOK_FAILED:", error)

    if (
      message ===
      "RETRY_UNBOUND_STRIPE_SUBSCRIPTION"
    ) {
      return NextResponse.json(
        {
          error:
            "Subscription binding is not ready yet. Retry required.",
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      {
        error:
          "Stripe event could not be processed.",
      },
      { status: 503 }
    )
  }
}