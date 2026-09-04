"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { StripePlan } from "@/lib/stripe-plans"

export function StripeSubscription({
  plan,
  name,
  formattedPrice,
  billingMode,
  email,
  ready,
  owner,
}: {
  plan: StripePlan
  name: string
  formattedPrice?: string
  billingMode: "subscription" | "payment"
  email?: string
  ready: boolean
  owner: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const recurring = billingMode === "subscription"

  async function openCheckout() {
    setBusy(true)
    setMessage("")

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      })

      const data = await response.json()

      if (!response.ok) throw new Error(data.error || "Checkout could not be prepared.")
      if (!data.url) throw new Error("Stripe checkout URL was not returned.")

      window.location.assign(data.url)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Checkout is unavailable. Please try again later.")
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#050812] bg-[radial-gradient(ellipse_at_top_left,#123c4c,transparent_65%)] px-5 py-12 text-white">
      <Card className="w-full max-w-xl rounded-3xl border-cyan-300/30 bg-gradient-to-br from-[#102835] to-[#211c36] p-7 text-white sm:p-10">
        <p className="text-sm uppercase tracking-widest text-cyan-200">Orbit LM · Your next chapter</p>
        <h1 className="mt-4 text-3xl font-semibold">{name}</h1>

        {formattedPrice ? (
          <p className="mt-5 text-4xl font-semibold">
            {formattedPrice}
            <span className="text-base font-normal text-slate-300">
              {recurring ? " / month" : " one-time"}
            </span>
          </p>
        ) : (
          <p className="mt-5 text-lg font-medium text-cyan-100">
            Final amount and available currency are shown securely by Stripe.
          </p>
        )}

        <p className="mt-4 text-sm leading-6 text-slate-300">
          {recurring
            ? "Renews monthly until canceled. Taxes and the final amount are shown securely by Stripe before payment."
            : "This is a one-time Business Customization payment. Taxes and the final amount are shown securely by Stripe before payment."}
        </p>

        {email && (
          <p className="my-5 break-all rounded-xl border border-cyan-200/20 p-3 text-sm">
            {recurring ? "Plan access" : "Purchase"} will be attached to <strong>{email}</strong>.
          </p>
        )}

        {owner && recurring ? (
          <p className="text-cyan-100">Your owner account already has full access. No subscription is needed.</p>
        ) : !ready ? (
          <p role="status" className="text-cyan-100">Checkout is being prepared. No payment has been taken.</p>
        ) : (
          <Button className="w-full" disabled={busy} onClick={openCheckout}>
            {busy ? "Opening secure checkout…" : "Continue to secure checkout"}
          </Button>
        )}

        {message && <p role="status" className="mt-5 text-sm text-cyan-100">{message}</p>}

        <div className="mt-7 flex flex-wrap gap-5 text-sm">
          <a className="text-cyan-200 underline" href="/dashboard">Open dashboard</a>
          <a className="text-slate-300 underline" href="https://orbit-landing-page-rose.vercel.app/#plans">Compare plans</a>
          <a className="text-slate-300 underline" href="/billing">Manage billing</a>
        </div>
      </Card>
    </main>
  )
}
