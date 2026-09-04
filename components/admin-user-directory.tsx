"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, ShieldCheck, Users, CreditCard, UserCog, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"

type UserRow = {
  id: string
  name?: string
  email: string
  isOwner: boolean
  plan: string
  status: string
  accessUntil?: string | null
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
  updatedAt?: string | null
}

type Metrics = {
  totalAccounts: number
  activePaid: number
  noPlan: number
  pastDue: number
  canceled: number
}

const planLabels: Record<string, string> = {
  none: "No plan",
  personal: "Personal",
  small_business: "Small Business",
  big_business: "Big Business",
  owner: "Owner",
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ")
}

export function AdminUserDirectory({ onSelect }: { onSelect: (email: string) => void }) {
  const [query, setQuery] = useState("")
  const [plan, setPlan] = useState("all")
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<UserRow[]>([])
  const [metrics, setMetrics] = useState<Metrics>({ totalAccounts: 0, activePaid: 0, noPlan: 0, pastDue: 0, canceled: 0 })
  const [hasMore, setHasMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const params = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: "25", plan, status })
    if (query.trim()) p.set("q", query.trim())
    return p.toString()
  }, [query, plan, status, page])

  async function load() {
    setBusy(true)
    setError("")
    try {
      const r = await fetch(`/api/admin/users?${params}`, { cache: "no-store" })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || "Could not load Orbit accounts.")
      setRows(d.users || [])
      setMetrics(d.metrics || metrics)
      setHasMore(Boolean(d.hasMore))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Orbit accounts.")
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(load, 250)
    return () => clearTimeout(timer)
  }, [params])

  useEffect(() => {
    setPage(1)
  }, [query, plan, status])

  const cards = [
    ["Accounts", metrics.totalAccounts, Users],
    ["Active paid", metrics.activePaid, CreditCard],
    ["No plan", metrics.noPlan, UserCog],
    ["Past due", metrics.pastDue, ShieldCheck],
  ] as const

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, Icon]) => (
          <Card key={label} className="rounded-2xl border-white/[.08] bg-[#081321] p-4 text-white">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">{label}</span>
              <Icon size={16} className="text-cyan-200" />
            </div>
            <div className="mt-3 text-2xl font-semibold">{value}</div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden rounded-[24px] border-white/[.08] bg-[#07111d] p-0 text-white">
        <div className="border-b border-white/[.07] p-4 sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-cyan-200">Application users</p>
              <h4 className="mt-1 text-lg font-semibold">Orbit account directory</h4>
              <p className="mt-1 text-xs text-slate-500">Application account, subscription and access data only. No investment, portfolio or personal finance data is loaded here.</p>
            </div>
            <Button variant="outline" onClick={load} disabled={busy} className="h-10 rounded-xl border-white/10 bg-white/[.03]">
              <RefreshCw size={15} className={busy ? "mr-2 animate-spin" : "mr-2"} /> Refresh
            </Button>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_180px_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email or exact user ID" className="h-11 rounded-xl border-white/10 bg-[#08121f] pl-10 text-white" />
            </div>
            <select value={plan} onChange={(e) => setPlan(e.target.value)} className="h-11 rounded-xl border border-white/10 bg-[#08121f] px-3 text-sm text-slate-200">
              <option value="all">All plans</option>
              <option value="none">No plan</option>
              <option value="personal">Personal</option>
              <option value="small_business">Small Business</option>
              <option value="big_business">Big Business</option>
              <option value="owner">Owner</option>
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 rounded-xl border border-white/10 bg-[#08121f] px-3 text-sm text-slate-200">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="unassigned">Unassigned</option>
              <option value="expired">Expired</option>
              <option value="past_due">Past due</option>
              <option value="canceled">Canceled</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {error && <div className="m-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b border-white/[.07] bg-black/[.12] text-[10px] uppercase tracking-[.14em] text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Account</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Access until</th>
                <th className="px-4 py-3 font-semibold">Billing link</th>
                <th className="px-4 py-3 text-right font-semibold">Admin</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-white/[.05] hover:bg-white/[.025]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-100">{row.name || "Orbit member"}</div>
                    <div className="text-xs text-slate-500">{row.email}</div>
                    <div className="mt-1 font-mono text-[10px] text-slate-600">{row.id}</div>
                  </td>
                  <td className="px-4 py-3"><Badge variant="outline" className="border-cyan-300/20 bg-cyan-300/[.04] text-cyan-100">{planLabels[row.plan] || row.plan}</Badge></td>
                  <td className="px-4 py-3"><Badge variant="outline" className="border-white/10 bg-white/[.03] text-slate-300">{statusLabel(row.status)}</Badge></td>
                  <td className="px-4 py-3 text-xs text-slate-400">{row.accessUntil ? new Date(row.accessUntil).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{row.stripeCustomerId ? "Stripe linked" : "Not linked"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button disabled={row.isOwner} onClick={() => onSelect(row.email)} className="h-9 rounded-xl bg-cyan-300 px-3 text-xs font-semibold text-slate-950 hover:bg-cyan-200">
                      {row.isOwner ? "Protected owner" : "Manage"}
                    </Button>
                  </td>
                </tr>
              ))}
              {!busy && rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">No Orbit accounts match this search.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 p-4">
          <span className="text-xs text-slate-500">Page {page}</span>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page === 1 || busy} onClick={() => setPage((p) => Math.max(1, p - 1))} className="h-9 rounded-xl border-white/10 bg-white/[.03]"><ChevronLeft size={15} /></Button>
            <Button variant="outline" disabled={!hasMore || busy} onClick={() => setPage((p) => p + 1)} className="h-9 rounded-xl border-white/10 bg-white/[.03]"><ChevronRight size={15} /></Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
