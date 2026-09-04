"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { limitsFor, type Plan } from "@/lib/plan-features"
import { PRICING_LINK } from "@/components/plan-lock"
import {
  CalendarClock,
  ChevronDown,
  Search,
  ShieldCheck,
  Sparkles,
  UserCog,
  UserRoundCheck,
} from "lucide-react"

const names: Record<string, string> = {
  none: "No active plan",
  personal: "Personal",
  small_business: "Small Business",
  big_business: "Big Business",
  owner: "Owner",
}

const fieldClass =
  "h-11 rounded-xl border-white/10 bg-[#08121f] text-sm text-white placeholder:text-slate-500 focus-visible:border-cyan-300/50 focus-visible:ring-cyan-300/10"

const selectClass =
  "h-11 w-full rounded-xl border border-white/10 bg-[#08121f] px-3 text-sm text-slate-200 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"

export function SubscriptionSettings({ me }: { me: Record<string, any> }) {
  const [email, setEmail] = useState("")
  const [account, setAccount] = useState<any>(null)
  const [plan, setPlan] = useState("personal")
  const [status, setStatus] = useState("active")
  const [until, setUntil] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const access = me.access || {}
  const limits = limitsFor((access.plan || "none") as Plan)

  async function lookup(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage("")
    setAccount(null)

    try {
      const r = await fetch("/api/admin/plans?email=" + encodeURIComponent(email))
      const d = await r.json()
      if (!r.ok) throw Error(d.error)

      setAccount({ ...d.user, access: d.access })
      setPlan(["personal", "small_business", "big_business"].includes(d.access?.plan) ? d.access.plan : "personal")
      setStatus("active")
      setUntil(d.access?.accessUntil ? new Date(d.access.accessUntil).toISOString().slice(0, 16) : "")
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not look up this account.")
    } finally {
      setBusy(false)
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!account || !window.confirm("Apply this access assignment to " + account.email + "? Existing records will be preserved.")) return

    setBusy(true)
    setMessage("")

    try {
      const r = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: account.email,
          plan,
          status,
          accessUntil: until ? new Date(until + "Z").toISOString() : null,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw Error(d.error)

      setAccount({ ...account, access: d.access })
      setMessage("Access assignment saved. The member’s app will refresh its permissions within a minute.")
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save access.")
    } finally {
      setBusy(false)
    }
  }

  const usageCards = ([
    ["activeLeads", "Active leads"],
    ["archivedLeads", "Archived leads"],
    ["clients", "Clients"],
  ] as const)

  return (
    <Card className="relative overflow-hidden rounded-[30px] border border-white/[.08] bg-[#07101c] p-0 text-white shadow-[0_24px_80px_rgba(0,0,0,.32)] lg:col-span-2">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_18%_0%,rgba(34,211,238,.16),transparent_42%),radial-gradient(circle_at_82%_0%,rgba(139,92,246,.12),transparent_38%)]" />

      <div className="relative p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/[.07] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.18em] text-cyan-200">
                Subscription & access
              </span>
              <span className="rounded-full border border-white/10 bg-white/[.035] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[.14em] text-slate-400">
                {access.status || "Checking"}
              </span>
            </div>

            <h2 className="mt-4 text-2xl font-semibold tracking-[-.03em] text-white">{names[access.plan] || "Checking access…"}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
              Your current Orbit workspace access, usage limits, and billing controls in one place.
            </p>
            {access.accessUntil && (
              <p className="mt-2 text-xs text-slate-500">Access valid until {new Date(access.accessUntil).toLocaleString()}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild className="h-10 rounded-xl bg-cyan-300 px-4 font-semibold text-slate-950 shadow-[0_8px_24px_rgba(34,211,238,.16)] hover:bg-cyan-200">
              <a href={PRICING_LINK}>Explore plans</a>
            </Button>
            {access.plan !== "owner" && (
              <Button asChild variant="outline" className="h-10 rounded-xl border-white/10 bg-white/[.035] px-4 text-slate-200 hover:bg-white/[.07]">
                <a href="/billing">Manage billing</a>
              </Button>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {usageCards.map(([key, label]) => (
            <div key={key} className="group rounded-2xl border border-white/[.08] bg-[#0a1524] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.025)] transition hover:border-cyan-300/[.18] hover:bg-[#0b1828]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">{label}</p>
                <span className="h-2 w-2 rounded-full bg-cyan-300/70 shadow-[0_0_14px_rgba(34,211,238,.5)]" />
              </div>
              <div className="mt-3 flex items-end gap-2">
                <b className="text-2xl font-semibold tracking-tight text-slate-50">{me.usage?.[key] ?? "—"}</b>
                <span className="pb-1 text-xs text-slate-500">/ {limits[key] === null ? "Unlimited" : limits[key]}</span>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-[11px] leading-5 text-slate-500">
          Limits apply to records owned by your workspace. Existing records are preserved when plans change. Subscription access activates after verified payment.
        </p>
      </div>

      {access.plan === "owner" && (
        <div className="relative border-t border-white/[.08] bg-[#050b14] p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-violet-300/20 bg-violet-300/[.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.16em] text-violet-200">Owner workspace</span>
                <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[.05] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[.12em] text-cyan-100">Admin only</span>
              </div>
              <h3 className="mt-3 text-xl font-semibold tracking-[-.02em] text-white">Account access control center</h3>
              <p className="mt-1 text-sm text-slate-500">Search a customer account, review its access, and apply changes without affecting billing.</p>
            </div>
          </div>

          <details className="group overflow-hidden rounded-[24px] border border-white/[.08] bg-[#091321] shadow-[0_18px_50px_rgba(0,0,0,.24)]" open>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 border-b border-white/[.07] px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-violet-300/20 bg-violet-300/[.08] text-violet-200">
                  <UserCog size={19} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-100">Manage account access</p>
                  <p className="mt-0.5 text-xs text-slate-500">Plan, status, and access expiration controls</p>
                </div>
              </div>
              <ChevronDown className="shrink-0 text-slate-500 transition-transform group-open:rotate-180" size={18} />
            </summary>

            <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[.82fr_1.18fr]">
              <section className="rounded-2xl border border-white/[.07] bg-[#07111d] p-4 sm:p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-300/15 bg-cyan-300/[.06] text-cyan-200"><Search size={16} /></div>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">Find an account</p>
                    <p className="mt-0.5 text-xs text-slate-500">Search by the customer’s Orbit email.</p>
                  </div>
                </div>

                <form onSubmit={lookup} className="space-y-3">
                  <label className="block text-[11px] font-medium text-slate-400">
                    Account email
                    <Input
                      aria-label="Member email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        setAccount(null)
                      }}
                      placeholder="member@example.com"
                      className={`${fieldClass} mt-2`}
                    />
                  </label>
                  <Button disabled={busy} className="h-11 w-full rounded-xl bg-cyan-300 font-semibold text-[#06101b] shadow-[0_8px_24px_rgba(34,211,238,.12)] hover:bg-cyan-200">
                    {busy ? "Searching…" : "Find account"}
                  </Button>
                </form>

                <div className="mt-4 flex gap-3 rounded-2xl border border-cyan-300/[.1] bg-cyan-300/[.035] p-3.5">
                  <ShieldCheck className="mt-0.5 shrink-0 text-cyan-200" size={16} />
                  <p className="text-xs leading-5 text-slate-500">Changes here modify Orbit access only. They do not create a Stripe charge or subscription on behalf of the customer.</p>
                </div>
              </section>

              <section className="rounded-2xl border border-white/[.07] bg-[#07111d] p-4 sm:p-5">
                {!account ? (
                  <div className="grid min-h-[260px] place-items-center text-center">
                    <div className="max-w-xs">
                      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-violet-300/15 bg-violet-300/[.06] text-violet-200"><UserRoundCheck size={21} /></div>
                      <p className="mt-4 text-sm font-semibold text-slate-200">No account selected</p>
                      <p className="mt-2 text-xs leading-5 text-slate-500">Search for an Orbit customer to review and update their access.</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={save} className="space-y-4">
                    <div className="rounded-2xl border border-white/[.08] bg-[#0a1625] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.02)]">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-100">{account.name || "Orbit member"}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">{account.email}</p>
                        </div>
                        <span className="rounded-full border border-violet-300/20 bg-violet-300/[.08] px-3 py-1 text-[10px] font-medium text-violet-100">{names[account.access?.plan] || "No active plan"}</span>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-[11px] font-medium text-slate-400">
                        Plan
                        <select className={`${selectClass} mt-2`} value={plan} onChange={(e) => setPlan(e.target.value)}>
                          <option value="personal">Personal</option>
                          <option value="small_business">Small Business</option>
                          <option value="big_business">Big Business</option>
                        </select>
                      </label>
                      <label className="text-[11px] font-medium text-slate-400">
                        Status
                        <select className={`${selectClass} mt-2`} value={status} onChange={(e) => setStatus(e.target.value)}>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="past_due">Past due</option>
                          <option value="canceled">Canceled</option>
                        </select>
                      </label>
                    </div>

                    <label className="block text-[11px] font-medium text-slate-400">
                      Access ends (UTC)
                      <div className="relative mt-2">
                        <CalendarClock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <Input type="datetime-local" required={status === "active"} value={until} onChange={(e) => setUntil(e.target.value)} className={`${fieldClass} pl-10`} />
                      </div>
                    </label>

                    <div className="flex items-start gap-3 rounded-2xl border border-violet-300/[.1] bg-violet-300/[.035] p-3.5">
                      <Sparkles className="mt-0.5 shrink-0 text-violet-200" size={16} />
                      <p className="text-xs leading-5 text-slate-500">Existing customer records are preserved when you change access. Owner accounts cannot be downgraded from this panel.</p>
                    </div>

                    <Button disabled={busy || account.access?.plan === "owner"} className="h-11 w-full rounded-xl bg-gradient-to-r from-cyan-300 to-cyan-200 font-semibold text-[#06101b] shadow-[0_10px_30px_rgba(34,211,238,.14)] hover:from-cyan-200 hover:to-cyan-100">
                      {busy ? "Saving…" : "Save access assignment"}
                    </Button>
                  </form>
                )}
              </section>
            </div>

            {message && (
              <p role="status" className="mx-4 mb-4 rounded-2xl border border-cyan-300/[.12] bg-cyan-300/[.04] px-4 py-3 text-sm text-cyan-100 sm:mx-5 sm:mb-5">{message}</p>
            )}
          </details>
        </div>
      )}
    </Card>
  )
}
