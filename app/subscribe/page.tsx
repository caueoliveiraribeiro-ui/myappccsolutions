import { cookies } from "next/headers"
import { getSession } from "@/lib/auth"
import { accountAccess } from "@/lib/plan-access"
import { HotmartSubscription } from "@/components/hotmart-subscription"
import {
  isStripePlan,
  stripeOffers,
} from "@/lib/stripe-plans"

export const dynamic = "force-dynamic"

const hotmartCheckouts = {
  personal: "https://pay.hotmart.com/G107468574F?off=fcv6cun6",
  small_business: "https://pay.hotmart.com/G107468574F?off=qks1vkpc",
  big_business: "https://pay.hotmart.com/G107468574F?off=n37sgoia",
  business_customization: "https://pay.hotmart.com/G107468574F?off=mo50qwjw",
} as const

const hotmartPrices = {
  personal: "$29.99",
  small_business: "$99.99",
  big_business: "$189.99",
  business_customization: "US$599.99",
} as const

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

  return (
    <HotmartSubscription
      name={stripeOffers[plan].name}
      formattedPrice={hotmartPrices[plan]}
      checkoutUrl={hotmartCheckouts[plan]}
      email={user?.email}
      owner={owner}
      customization={plan === "business_customization"}
    />
  )
}
