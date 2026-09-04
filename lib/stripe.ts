import Stripe from "stripe"

export const ORBIT_ORIGIN = "https://orbit-lm.com"

let stripeClient: Stripe | null = null

export function getStripe() {
  if (stripeClient) return stripeClient

  const secretKey = process.env.STRIPE_SECRET_KEY

  if (!secretKey) {
    throw new Error("STRIPE_NOT_CONFIGURED")
  }

  stripeClient = new Stripe(secretKey)

  return stripeClient
}

export function stripeBillingReady() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET &&
      process.env.STRIPE_PRICE_PERSONAL &&
      process.env.STRIPE_PRICE_SMALL_BUSINESS &&
      process.env.STRIPE_PRICE_BIG_BUSINESS &&
      process.env.STRIPE_PRICE_BUSINESS_CUSTOMIZATION
  )
}