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
  "h-11 rounded-xl border-white/10 bg-[#07111f]/90 text-sm text-white placeholder:text-slate-500 focus-visible:border-cyan-300/40 focus-visible:ring-cyan-300/10"

const selectClass =
  "h-11 w-full rounded-xl border border-white/10 bg-[#07111f]/90 px-3 text-sm text-slate-200 outline-none transition focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/10"

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

  return (
    <Card className="overflow-hidden rounded-[28px] border-cyan-300/20 bg-gradient-to-br from-cyan-300/[.06] via-[#0a1321] to-violet-400/[.05] p-0 text-white shadow-[0_24px_70px_rgba(0,0,0,.22)] lg:col-span-2">
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-cyan-200/80">Subscription & access</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">Your Orbit plan</h2>
            <p className="mt-2 text-sm text-cyan-200">{names[access.plan] || "Checking access…"} · {access.status || "Checking"}</p>
            {access.accessUntil && (
              <p className="mt-1 text-xs text-slate-500">Access valid until {new Date(access.accessUntil).toLocaleString()}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild className="bg-cyan-300 text-slate-950 hover:bg-cyan-200">
              <a href={PRICING_LINK}>Explore plans</a>
            </Button>
            {access.plan !== "owner" && (
              <Button asChild variant="outline" className="border-white/10 bg-white/[.025] text-slate-200">
                <a href="/billing">Manage billing</a>
              </Button>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {([[
            "activeLeads",
            "Active leads",
          ], [
            "archivedLeads",
            "Archived leads",
          ], [
            "clients",
            "Clients",
          ]] as const).map(([key, label]) => (
            <div key={key} className="rounded-2xl border border-white/[.07] bg-black/[.14] p-4">
              <p className="text-[11px] uppercase tracking-[.12em] text-slate-500">{label}</p>
              <b className="mt-1 block text-lg font-semibold text-slate-100">
                {me.usage?.[key] ?? "—"} / {limits[key] === null ? "Unlimited" : limits[key]}
              </b>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs leading-5 text-slate-500">
          Limits apply to records owned by your workspace. Existing records are kept when plans change. Subscription access activates after verified payment.
        </p>
      </div>

      {access.plan === "owner" && (
        <div className="border-t border-white/[.07] bg-[#07111f]/65 p-4 sm:p-6">
          <details className="group overflow-hidden rounded-[24px] border border-violet-300/[.14] bg-[#091321]/85 shadow-[inset_0_1px_0_rgba(255,255,255,.03)]" open>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 sm:px-6">
              <div className="flex min-w-0 items-center gap-3.5">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-violet-300/20 bg-violet-300/[.08] text-violet-200">
                  <UserCog size={20} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-violet-200/80">Owner controls</p>
                    <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[.05] px-2 py-0.5 text-[9px] font-medium uppercase tracking-[.1em] text-cyan-100">Admin only</span>
                  </div>
                  <h3 className="mt-1 text-lg font-semibold tracking-tight text-white">Manage account access</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Search for a verified Orbit account and update its plan, status, or access end date.</p>
                </div>
              </div>
              <ChevronDown className="shrink-0 text-slate-500 transition-transform group-open:rotate-180" size={19} />
            </summary>

            <div className="border-t border-white/[.07] p-5 sm:p-6">
              <div className="grid gap-5 xl:grid-cols-[.92fr_1.08fr]">
                <section className="rounded-2xl border border-white/[.07] bg-black/[.1] p-4 sm:p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-300/15 bg-cyan-300/[.05] text-cyan-200">
                      <Search size={17} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-100">Find a member</p>
                      <p className="mt-0.5 text-xs text-slate-500">Use the email attached to their Orbit account.</p>
                    </div>
                  </div>

                  <form onSubmit={lookup} className="space-y-3">
                    <label className="block text-[11px] font-medium text-slate-400">
                      Member email
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
                    <Button disabled={busy} className="h-11 w-full rounded-xl bg-cyan-300 font-semibold text-[#06101b] hover:bg-cyan-200">
                      {busy ? "Searching…" : "Find account"}
                    </Button>
                  </form>

                  <div className="mt-4 rounded-2xl border border-cyan-300/[.09] bg-cyan-300/[.025] p-3.5">
                    <div className="flex gap-3">
                      <ShieldCheck className="mt-0.5 shrink-0 text-cyan-200" size={16} />
                      <p className="text-xs leading-5 text-slate-500">
                        Changes here modify Orbit access only. They do not create a Stripe charge or subscription on behalf of the customer.
                      </p>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-white/[.07] bg-black/[.1] p-4 sm:p-5">
                  {!account ? (
                    <div className="grid min-h-[300px] place-items-center text-center">
                      <div className="max-w-xs">
                        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-violet-300/15 bg-violet-300/[.05] text-violet-200">
                          <UserRoundCheck size={21} />
                        </div>
                        <p className="mt-4 text-sm font-medium text-slate-200">Account details will appear here</p>
                        <p className="mt-2 text-xs leading-5 text-slate-500">Find a member first, then review and update their access.</p>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={save} className="space-y-4">
                      <div className="rounded-2xl border border-white/[.08] bg-[#07111f]/80 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-100">{account.name || "Orbit member"}</p>
                            <p className="mt-0.5 truncate text-xs text-slate-500">{account.email}</p>
                          </div>
                          <span className="rounded-full border border-violet-300/20 bg-violet-300/[.08] px-3 py-1 text-[10px] font-medium text-violet-100">
                            {names[account.access?.plan] || "No active plan"}
                          </span>
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
                          <Input
                            type="datetime-local"
                            required={status === "active"}
                            value={until}
                            onChange={(e) => setUntil(e.target.value)}
                            className={`${fieldClass} pl-10`}
                          />
                        </div>
                      </label>

                      <div className="flex items-start gap-3 rounded-2xl border border-violet-300/[.1] bg-violet-300/[.03] p-3.5">
                        <Sparkles className="mt-0.5 shrink-0 text-violet-200" size={16} />
                        <p className="text-xs leading-5 text-slate-500">
                          Existing customer records are preserved when you change access. Owner accounts cannot be downgraded from this panel.
                        </p>
                      </div>

                      <Button
                        disabled={busy || account.access?.plan === "owner"}
                        className="h-11 w-full rounded-xl bg-gradient-to-r from-cyan-300 to-cyan-200 font-semibold text-[#06101b] shadow-[0_10px_30px_rgba(34,211,238,.12)] hover:from-cyan-200 hover:to-cyan-100"
                      >
                        {busy ? "Saving…" : "Save access assignment"}
                      </Button>
                    </form>
                  )}
                </section>
              </div>

              {message && (
                <p role="status" className="mt-4 rounded-2xl border border-cyan-300/[.12] bg-cyan-300/[.035] px-4 py-3 text-sm text-cyan-100">
                  {message}
                </p>
              )}
            </div>
          </details>
        </div>
      )}
    </Card>
  )
}
