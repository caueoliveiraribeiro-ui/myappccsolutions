import { cookies } from "next/headers"
import { getSession } from "@/lib/auth"
import { accountAccess } from "@/lib/plan-access"
import { StripeSubscription } from "@/components/stripe-subscription"
import {
  isStripePlan,
  isSubscriptionPlan,
  stripeOffers,
  type StandardPlan,
} from "@/lib/stripe-plans"
import { stripeBillingReady } from "@/lib/stripe"

export const dynamic = "force-dynamic"

const monthlyPrices: Record<StandardPlan, number> = {
  personal: 29.99,
  small_business: 99.99,
  big_business: 189.99,
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

        <p className="my-5">
          Select a plan to continue to secure checkout.
        </p>

        <a
          className="text-cyan-300"
          href="https://orbit-landing-page-rose.vercel.app/#plans"
        >
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

  const subscription = isSubscriptionPlan(plan)

  return (
    <StripeSubscription
      plan={plan}
      name={stripeOffers[plan].name}
      amountUsd={subscription ? monthlyPrices[plan] : undefined}
      billingMode={subscription ? "subscription" : "payment"}
      email={user?.email}
      ready={stripeBillingReady()}
      owner={owner}
    />
  )
}
