export const stripeOffers = {
  personal: {
    name: "Personal",
    priceId: process.env.STRIPE_PRICE_PERSONAL!,
    type: "subscription",
  },

  small_business: {
    name: "Small Business",
    priceId: process.env.STRIPE_PRICE_SMALL_BUSINESS!,
    type: "subscription",
  },

  big_business: {
    name: "Big Business",
    priceId: process.env.STRIPE_PRICE_BIG_BUSINESS!,
    type: "subscription",
  },

  business_customization: {
    name: "Business Customization",
    priceId: process.env.STRIPE_PRICE_BUSINESS_CUSTOMIZATION!,
    type: "payment",
  },
} as const

export type StripePlan = keyof typeof stripeOffers

export type StandardPlan =
  | "personal"
  | "small_business"
  | "big_business"

export function isStripePlan(value: unknown): value is StripePlan {
  return (
    value === "personal" ||
    value === "small_business" ||
    value === "big_business" ||
    value === "business_customization"
  )
}

export function isSubscriptionPlan(
  value: StripePlan
): value is StandardPlan {
  return (
    value === "personal" ||
    value === "small_business" ||
    value === "big_business"
  )
}

export function planForStripePrice(priceId: string): StripePlan | null {
  for (const plan of Object.keys(stripeOffers) as StripePlan[]) {
    if (stripeOffers[plan].priceId === priceId) {
      return plan
    }
  }

  return null
}