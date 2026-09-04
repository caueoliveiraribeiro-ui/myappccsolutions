"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { limitsFor, type Plan } from "@/lib/plan-features"
import { PRICING_LINK } from "@/components/plan-lock"
import { AdminUserDirectory } from "@/components/admin-user-directory"
import {
  CalendarClock,
  KeyRound,
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
  const isOwner = access.plan === "owner"

  async function loadAccount(targetEmail: string) {
    const normalized = targetEmail.trim().toLowerCase()
    if (!normalized) return
    setBusy(true)
    setMessage("")
    setAccount(null)
    setEmail(normalized)

    try {
      const r = await fetch("/api/admin/plans?email=" + encodeURIComponent(normalized))
      const d = await r.json()
      if (!r.ok) throw Error(d.error)

      setAccount({ ...d.user, access: d.access })
      setPlan(["personal", "small_business", "big_business"].includes(d.access?.plan) ? d.access.plan : "personal")
      setStatus(["active", "inactive", "past_due", "canceled"].includes(d.access?.status) ? d.access.status : "active")
      setUntil(d.access?.accessUntil ? new Date(d.access.accessUntil).toISOString().slice(0, 16) : "")
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not look up this account.")
    } finally {
      setBusy(false)
    }
  }

  async function lookup(e: React.FormEvent) {
    e.preventDefault()
    await loadAccount(email)
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
      setMessage("Application access updated. Customer records and billing data were not changed.")
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save access.")
    } finally {
      setBusy(false)
    }
  }

  async function sendReset() {
    if (!account?.email || account.access?.plan === "owner") return
    if (!window.confirm("Send a secure password-reset link to " + account.email + "?")) return

    setBusy(true)
    setMessage("")
    try {
      const r = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: account.email }),
      })
      const d = await r.json()
      if (!r.ok) throw Error(d.error || "Could not request a password reset.")
      setMessage("Password-reset request accepted. If the account is eligible, Orbit sent a secure reset email.")
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not request a password reset.")
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

      {!isOwner && (
        <div className="relative p-5 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/[.07] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.18em] text-cyan-200">Subscription & access</span>
                <span className="rounded-full border border-white/10 bg-white/[.035] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[.14em] text-slate-400">{access.status || "Checking"}</span>
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-[-.03em] text-white">{names[access.plan] || "Checking access…"}</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Your current Orbit workspace access, usage limits, and billing controls in one place.</p>
              {access.accessUntil && <p className="mt-2 text-xs text-slate-500">Access valid until {new Date(access.accessUntil).toLocaleString()}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="h-10 rounded-xl bg-cyan-300 px-4 font-semibold text-slate-950 hover:bg-cyan-200"><a href={PRICING_LINK}>Explore plans</a></Button>
              <Button asChild variant="outline" className="h-10 rounded-xl border-white/10 bg-white/[.035] px-4 text-slate-200 hover:bg-white/[.07]"><a href="/billing">Manage billing</a></Button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {usageCards.map(([key, label]) => (
              <div key={key} className="rounded-2xl border border-white/[.08] bg-[#0a1524] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">{label}</p>
                <div className="mt-3 flex items-end gap-2"><b className="text-2xl font-semibold text-slate-50">{me.usage?.[key] ?? "—"}</b><span className="pb-1 text-xs text-slate-500">/ {limits[key] === null ? "Unlimited" : limits[key]}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isOwner && (
        <div className="relative p-4 sm:p-6">
          <div className="mb-5 rounded-[24px] border border-violet-300/[.14] bg-gradient-to-br from-violet-300/[.07] to-cyan-300/[.035] p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-violet-300/20 bg-violet-300/[.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.16em] text-violet-200">Orbit administration</span>
                  <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[.05] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[.12em] text-cyan-100">Protected owner</span>
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-.03em] text-white">Application control center</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">Manage Orbit application accounts, subscriptions and access. This admin area intentionally does not read your personal investments, stocks, crypto, expenses or portfolio records.</p>
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-cyan-300/[.12] bg-black/[.12] px-4 py-3 text-xs text-cyan-100"><ShieldCheck size={16} /> Owner-only API protection</div>
            </div>
          </div>

          <AdminUserDirectory onSelect={loadAccount} />

          <div className="mt-5 grid gap-4 xl:grid-cols-[.82fr_1.18fr]">
            <section className="rounded-[24px] border border-white/[.08] bg-[#091321] p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/15 bg-cyan-300/[.06] text-cyan-200"><Search size={17} /></div>
                <div><p className="text-sm font-semibold text-slate-100">Direct account lookup</p><p className="mt-0.5 text-xs text-slate-500">Open an account by exact email for access controls.</p></div>
              </div>
              <form onSubmit={lookup} className="space-y-3">
                <Input aria-label="Member email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="member@example.com" className={fieldClass} />
                <Button disabled={busy} className="h-11 w-full rounded-xl bg-cyan-300 font-semibold text-[#06101b] hover:bg-cyan-200">{busy ? "Loading…" : "Open account"}</Button>
              </form>
              <div className="mt-4 flex gap-3 rounded-2xl border border-cyan-300/[.1] bg-cyan-300/[.035] p-3.5"><ShieldCheck className="mt-0.5 shrink-0 text-cyan-200" size={16} /><p className="text-xs leading-5 text-slate-500">Admin actions change Orbit application access only unless explicitly labeled as billing or password actions.</p></div>
            </section>

            <section className="rounded-[24px] border border-white/[.08] bg-[#091321] p-4 sm:p-5">
              {!account ? (
                <div className="grid min-h-[290px] place-items-center text-center"><div className="max-w-sm"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-violet-300/15 bg-violet-300/[.06] text-violet-200"><UserRoundCheck size={21} /></div><p className="mt-4 text-sm font-semibold text-slate-200">Select an application account</p><p className="mt-2 text-xs leading-5 text-slate-500">Use the directory above or exact-email lookup to manage an Orbit customer.</p></div></div>
              ) : (
                <form onSubmit={save} className="space-y-4">
                  <div className="rounded-2xl border border-white/[.08] bg-[#0a1625] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-100">{account.name || "Orbit member"}</p><p className="mt-0.5 truncate text-xs text-slate-500">{account.email}</p><p className="mt-1 font-mono text-[10px] text-slate-600">{account.id}</p></div>
                      <span className="rounded-full border border-violet-300/20 bg-violet-300/[.08] px-3 py-1 text-[10px] font-medium text-violet-100">{names[account.access?.plan] || "No active plan"}</span>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-[11px] font-medium text-slate-400">Plan<select className={`${selectClass} mt-2`} value={plan} onChange={(e) => setPlan(e.target.value)}><option value="personal">Personal</option><option value="small_business">Small Business</option><option value="big_business">Big Business</option></select></label>
                    <label className="text-[11px] font-medium text-slate-400">Status<select className={`${selectClass} mt-2`} value={status} onChange={(e) => setStatus(e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="past_due">Past due</option><option value="canceled">Canceled</option></select></label>
                  </div>

                  <label className="block text-[11px] font-medium text-slate-400">Access ends (UTC)<div className="relative mt-2"><CalendarClock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} /><Input type="datetime-local" required={status === "active"} value={until} onChange={(e) => setUntil(e.target.value)} className={`${fieldClass} pl-10`} /></div></label>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button disabled={busy || account.access?.plan === "owner"} className="h-11 rounded-xl bg-gradient-to-r from-cyan-300 to-cyan-200 font-semibold text-[#06101b] hover:from-cyan-200 hover:to-cyan-100">{busy ? "Saving…" : "Save application access"}</Button>
                    <Button type="button" variant="outline" onClick={sendReset} disabled={busy || account.access?.plan === "owner"} className="h-11 rounded-xl border-white/10 bg-white/[.035] text-slate-200"><KeyRound size={16} className="mr-2" />Send password reset</Button>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl border border-violet-300/[.1] bg-violet-300/[.035] p-3.5"><Sparkles className="mt-0.5 shrink-0 text-violet-200" size={16} /><p className="text-xs leading-5 text-slate-500">Owner identities are protected from downgrade and password-reset actions. Customer business records remain intact when access changes.</p></div>
                </form>
              )}
            </section>
          </div>

          {message && <p role="status" className="mt-4 rounded-2xl border border-cyan-300/[.12] bg-cyan-300/[.04] px-4 py-3 text-sm text-cyan-100">{message}</p>}
        </div>
      )}
    </Card>
  )
}
