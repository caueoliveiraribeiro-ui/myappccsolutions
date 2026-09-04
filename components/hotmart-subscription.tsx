"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export function HotmartSubscription({
  name,
  formattedPrice,
  checkoutUrl,
  email,
  owner,
}: {
  name: string
  formattedPrice: string
  checkoutUrl: string
  email?: string
  owner: boolean
}) {
  const [busy, setBusy] = useState(false)

  function checkoutWithTracking() {
    const target = new URL(checkoutUrl)
    const current = new URLSearchParams(window.location.search)

    current.forEach((value, key) => {
      if (key !== "plan" && !target.searchParams.has(key)) {
        target.searchParams.append(key, value)
      }
    })

    return target.toString()
  }

  function openCheckout() {
    setBusy(true)
    window.location.assign(checkoutWithTracking())
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#050812] bg-[radial-gradient(ellipse_at_top_left,#123c4c,transparent_65%)] px-5 py-12 text-white">
      <Card className="w-full max-w-xl rounded-3xl border-cyan-300/30 bg-gradient-to-br from-[#102835] to-[#211c36] p-7 text-white sm:p-10">
        <p className="text-sm uppercase tracking-widest text-cyan-200">Orbit LM · Your next chapter</p>
        <h1 className="mt-4 text-3xl font-semibold">{name}</h1>

        <p className="mt-5 text-4xl font-semibold">
          {formattedPrice}
          <span className="text-base font-normal text-slate-300"> / month</span>
        </p>

        <p className="mt-4 text-sm leading-6 text-slate-300">
          Renews monthly until canceled. Taxes, available payment methods and the final amount are shown securely by Hotmart before payment.
        </p>

        {email && (
          <p className="my-5 break-all rounded-xl border border-cyan-200/20 p-3 text-sm leading-6">
            To match this purchase automatically to your Orbit account, use the same email at Hotmart checkout: <strong>{email}</strong>.
          </p>
        )}

        {owner ? (
          <p className="text-cyan-100">Your owner account already has full access. No subscription is needed.</p>
        ) : (
          <Button className="w-full" disabled={busy} onClick={openCheckout}>
            {busy ? "Opening secure checkout…" : "Continue to secure checkout"}
          </Button>
        )}

        <div className="mt-7 flex flex-wrap gap-5 text-sm">
          <a className="text-cyan-200 underline" href="/dashboard">Open dashboard</a>
          <a className="text-slate-300 underline" href="/plans">Compare plans</a>
          <a className="text-slate-300 underline" href="/billing">Manage billing</a>
        </div>
      </Card>
    </main>
  )
}
