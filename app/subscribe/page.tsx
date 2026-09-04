import { cookies } from "next/headers"
import { getSession } from "@/lib/auth"
import { accountAccess } from "@/lib/plan-access"
import { StripeSubscription } from "@/components/stripe-subscription"
import { HotmartSubscription } from "@/components/hotmart-subscription"
import {
  isStripePlan,
  isSubscriptionPlan,
  stripeOffers,
} from "@/lib/stripe-plans"
import { getStripe, stripeBillingReady } from "@/lib/stripe"

export const dynamic = "force-dynamic"

const hotmartCheckouts = {
  personal: "https://pay.hotmart.com/G107468574F?off=fcv6cun6",
  small_business: "https://pay.hotmart.com/G107468574F?off=qks1vkpc",
  big_business: "https://pay.hotmart.com/G107468574F?off=n37sgoia",
} as const

const hotmartPrices = {
  personal: "$29.99",
  small_business: "$99.99",
  big_business: "$189.99",
} as const

function formatStripeAmount(unitAmount: number, currency: string) {
  const zeroDecimalCurrencies = new Set([
    "bif","clp","djf","gnf","jpy","kmf","krw","mga","pyg","rwf","ugx","vnd","vuv","xaf","xof","xpf",
  ])
  const normalizedCurrency = currency.toLowerCase()
  const amount = zeroDecimalCurrencies.has(normalizedCurrency)
    ? unitAmount
    : unitAmount / 100

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: normalizedCurrency.toUpperCase(),
    minimumFractionDigits: zeroDecimalCurrencies.has(normalizedCurrency) ? 0 : 2,
    maximumFractionDigits: zeroDecimalCurrencies.has(normalizedCurrency) ? 0 : 2,
  }).format(amount)
}

export default async function Subscribe({
  searchParams,
}: {
  searchParams: Promise<{
    plan?: string
    checkout?: string
    session_id?: string
  }>
}) {
  const params = await searchParams
  const plan = params.plan

  if (!plan || !isStripePlan(plan)) {
    return (
      <main className="min-h-screen bg-[#050812] p-10 text-white">
        <h1 className="text-3xl">Choose your Orbit</h1>
        <p className="my-5">Select a plan to continue to secure checkout.</p>
        <a className="text-cyan-300" href="/plans">
          Explore plans →
        </a>
      </main>
    )
  }

  const token = (await cookies()).get("orbit_session")?.value
  const user = token ? await getSession(token) : null

  let owner = false
  if (user) {
    const access = await accountAccess(user.id)
    owner = access.plan === "owner"
  }

  if (isSubscriptionPlan(plan)) {
    return (
      <HotmartSubscription
        name={stripeOffers[plan].name}
        formattedPrice={hotmartPrices[plan]}
        checkoutUrl={hotmartCheckouts[plan]}
        email={user?.email}
        owner={owner}
      />
    )
  }

  const ready = stripeBillingReady()
  let formattedPrice: string | undefined

  if (ready) {
    try {
      const price = await getStripe().prices.retrieve(stripeOffers[plan].priceId)
      if (typeof price.unit_amount === "number" && price.currency) {
        formattedPrice = formatStripeAmount(price.unit_amount, price.currency)
      }
    } catch (error) {
      console.error("Unable to load Stripe price for subscribe page", error)
    }
  }

  return (
    <StripeSubscription
      plan={plan}
      name={stripeOffers[plan].name}
      formattedPrice={formattedPrice}
      billingMode="payment"
      email={user?.email}
      ready={ready}
      owner={owner}
    />
  )
}
