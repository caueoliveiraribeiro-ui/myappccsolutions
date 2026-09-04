"use client"

import { SubscriptionSettings } from "@/components/subscription-settings"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import {
  Eye,
  Mail,
  PencilLine,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react"

type R = Record<string, any>

export const markets = [
  { code: "US", flag: "🇺🇸", name: "United States", language: "en", languageName: "English", currency: "USD" },
  { code: "BR", flag: "🇧🇷", name: "Brasil", language: "pt", languageName: "Português", currency: "BRL" },
  { code: "GB", flag: "🇬🇧", name: "United Kingdom", language: "en", languageName: "English", currency: "GBP" },
  { code: "DE", flag: "🇩🇪", name: "Deutschland", language: "de", languageName: "Deutsch", currency: "EUR" },
  { code: "FR", flag: "🇫🇷", name: "France", language: "fr", languageName: "Français", currency: "EUR" },
  { code: "ES", flag: "🇪🇸", name: "España", language: "es", languageName: "Español", currency: "EUR" },
  { code: "IT", flag: "🇮🇹", name: "Italia", language: "it", languageName: "Italiano", currency: "EUR" },
  { code: "PT", flag: "🇵🇹", name: "Portugal", language: "pt", languageName: "Português", currency: "EUR" },
  { code: "CA", flag: "🇨🇦", name: "Canada", language: "en", languageName: "English / Français", currency: "CAD" },
  { code: "AU", flag: "🇦🇺", name: "Australia", language: "en", languageName: "English", currency: "AUD" },
  { code: "JP", flag: "🇯🇵", name: "日本", language: "ja", languageName: "日本語", currency: "JPY" },
  { code: "KR", flag: "🇰🇷", name: "대한민국", language: "ko", languageName: "한국어", currency: "KRW" },
  { code: "MX", flag: "🇲🇽", name: "México", language: "es", languageName: "Español", currency: "MXN" },
  { code: "NL", flag: "🇳🇱", name: "Nederland", language: "nl", languageName: "Nederlands", currency: "EUR" },
  { code: "CH", flag: "🇨🇭", name: "Schweiz / Suisse", language: "de", languageName: "Deutsch / Français / Italiano", currency: "CHF" },
]

const languages = [...new Map(markets.map((x) => [x.language, x])).values()].map((x) => ({
  code: x.language,
  name: x.languageName.split(" / ")[0],
}))
const currencies = [...new Set(markets.map((x) => x.currency))]

const fieldClass =
  "h-11 rounded-xl border-white/10 bg-[#08111f]/85 text-sm text-white placeholder:text-slate-500 focus-visible:border-cyan-300/50 focus-visible:ring-cyan-300/15"
const selectClass =
  "h-11 w-full rounded-xl border border-white/10 bg-[#08111f]/85 px-3 text-sm text-slate-200 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"

export function SettingsV2({ me, setMe, inviteOnly = false }: R) {
  const [name, setName] = useState(me.name || "")
  const [country, setCountry] = useState(me.country || "US")
  const [language, setLanguage] = useState(me.language || "en")
  const [currency, setCurrency] = useState(me.currency || "USD")
  const [people, setPeople] = useState<R[]>([])
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (inviteOnly) {
      fetch("/api/collaboration")
        .then((r) => r.json())
        .then((d) => setPeople(d.invites || []))
        .catch(() => {})
    }
  }, [inviteOnly])

  async function save() {
    const r = await fetch("/api/profile/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, country, language, currency }),
    })
    const d = await r.json()
    if (!r.ok) return toast.error(d.error || "We could not save this change. Please try again.")
    setMe((m: R) => ({ ...m, name, country, language, currency }))
    toast.success("Preferences saved")
  }

  async function invite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    const emails = String(f.get("emails") || "").split(/[\s,;]+/).filter(Boolean)
    const names = String(f.get("recipient_names") || "").split(",").map((x) => x.trim())
    let sent = 0

    try {
      for (const [email, i] of emails.map((x, i) => [x, i] as const)) {
        const body = {
          email,
          senderName: f.get("sender_name"),
          recipientName: names[i] || names[0] || "there",
          message: f.get("message"),
          relationship: f.get("relationship"),
          permission: f.get("permission"),
        }
        const r = await fetch("/api/collaboration", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        })
        const d = await r.json()
        if (r.ok) {
          sent++
          setPeople((v) => [{ ...body, status: d.status, id: crypto.randomUUID() }, ...v])
        } else {
          toast.error(`${email}: ${d.error || "Invitation could not be sent."}`)
        }
      }
      setSending(false)
      if (sent) {
        form.reset()
        toast.success(`${sent} invitation${sent === 1 ? "" : "s"} sent`)
      }
    } catch {
      toast.error("The connection was interrupted. Please check your circle before retrying.")
    } finally {
      setSending(false)
    }
  }

  if (inviteOnly) {
    const activeCount = people.filter((person) =>
      ["active", "accepted", "connected"].includes(String(person.status || "").toLowerCase())
    ).length
    const pendingCount = Math.max(people.length - activeCount, 0)

    return (
      <div className="mx-auto w-full max-w-6xl space-y-5 text-white">
        <section className="relative overflow-hidden rounded-[30px] border border-white/[.09] bg-[#07111f] shadow-[0_30px_90px_rgba(0,0,0,.28)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_9%_0%,rgba(34,211,238,.16),transparent_31%),radial-gradient(circle_at_92%_8%,rgba(167,139,250,.16),transparent_30%)]" />
          <div className="relative p-5 sm:p-7 lg:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex max-w-2xl items-start gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-cyan-200/25 bg-cyan-300/[.09] text-cyan-200 shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_0_32px_rgba(34,211,238,.11)]">
                  <Users size={25} strokeWidth={1.8} />
                </div>
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[.24em] text-cyan-200/90">Orbit sharing</p>
                    <span className="rounded-full border border-violet-300/20 bg-violet-300/[.08] px-2.5 py-1 text-[10px] font-medium text-violet-100">Owner controls</span>
                  </div>
                  <h2 className="text-2xl font-semibold tracking-[-.03em] text-white sm:text-3xl">Your circle</h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                    Invite the people you trust and keep a clear view of who has access to your Orbit workspace.
                  </p>
                </div>
              </div>

              <div className="grid min-w-full grid-cols-3 gap-2 sm:min-w-[360px]">
                <Stat value={people.length} label="People" />
                <Stat value={activeCount} label="Connected" accent="cyan" />
                <Stat value={pendingCount} label="Pending" accent="violet" />
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.08fr_.92fr]">
          <Card className="overflow-hidden rounded-[26px] border-white/[.08] bg-[#091321]/95 p-0 text-white shadow-[0_20px_60px_rgba(0,0,0,.2)]">
            <div className="border-b border-white/[.07] px-5 py-5 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-cyan-200">
                    <UserPlus size={17} />
                    <span className="text-[11px] font-semibold uppercase tracking-[.18em]">Invite someone</span>
                  </div>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight">Bring someone into your Orbit</h3>
                  <p className="mt-1.5 text-sm leading-6 text-slate-400">Choose their role, add a personal note, and send a secure invitation.</p>
                </div>
                <Sparkles className="hidden text-violet-300/70 sm:block" size={20} />
              </div>
            </div>

            <form className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6" onSubmit={invite}>
              <Field label="Your name">
                <Input className={fieldClass} name="sender_name" required defaultValue={me.name} placeholder="Your name" />
              </Field>
              <Field label="Recipient name">
                <Input className={fieldClass} name="recipient_names" required placeholder="Name or comma-separated names" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Email address">
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <Input className={`${fieldClass} pl-10`} name="emails" type="text" required placeholder="name@company.com" />
                  </div>
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Personal message">
                  <Textarea className="min-h-28 rounded-xl border-white/10 bg-[#08111f]/85 text-sm text-white placeholder:text-slate-500 focus-visible:border-cyan-300/50 focus-visible:ring-cyan-300/15" name="message" required placeholder="Add a short note so they know why you're inviting them." />
                </Field>
              </div>
              <Field label="Relationship">
                <select className={selectClass} name="relationship" defaultValue="Friend">
                  <option>Parent</option>
                  <option>Family</option>
                  <option>Friend</option>
                  <option>Employee</option>
                  <option>Partner</option>
                </select>
              </Field>
              <Field label="Permission">
                <select className={selectClass} name="permission" defaultValue="editor">
                  <option value="editor">Can edit</option>
                  <option value="viewer">View only</option>
                </select>
              </Field>

              <div className="sm:col-span-2 rounded-2xl border border-cyan-300/[.12] bg-cyan-300/[.035] p-3.5">
                <div className="flex gap-3">
                  <ShieldCheck className="mt-0.5 shrink-0 text-cyan-200" size={17} />
                  <p className="text-xs leading-5 text-slate-400">
                    Recipients currently need a verified Orbit account and eligible plan access. Only invite people you trust.
                  </p>
                </div>
              </div>

              <Button disabled={sending} className="sm:col-span-2 h-11 rounded-xl bg-gradient-to-r from-cyan-300 to-cyan-200 font-semibold text-[#06101c] shadow-[0_10px_30px_rgba(34,211,238,.14)] hover:from-cyan-200 hover:to-cyan-100">
                {sending ? "Sending invitation…" : "Send invitation"}
              </Button>
            </form>
          </Card>

          <Card className="overflow-hidden rounded-[26px] border-white/[.08] bg-[#091321]/95 p-0 text-white shadow-[0_20px_60px_rgba(0,0,0,.2)]">
            <div className="border-b border-white/[.07] px-5 py-5 sm:px-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-violet-200/90">Access overview</p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight">People with access</h3>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[.035] px-3 py-1.5 text-xs text-slate-300">{people.length} total</span>
              </div>
            </div>

            <div className="p-4 sm:p-5">
              {people.length === 0 ? (
                <div className="grid min-h-[310px] place-items-center rounded-2xl border border-dashed border-white/[.11] bg-black/[.08] px-6 text-center">
                  <div className="max-w-xs py-8">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[.05] text-cyan-200">
                      <Users size={21} />
                    </div>
                    <h4 className="mt-4 font-medium text-slate-200">No one here yet</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-500">Send your first invitation and their access status will appear here.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {people.map((person) => {
                    const permission = String(person.permission || "viewer").toLowerCase()
                    const canEdit = permission === "editor"
                    const status = String(person.status || "pending")
                    const connected = ["active", "accepted", "connected"].includes(status.toLowerCase())
                    const initials = String(person.recipientName || person.email || "O")
                      .split(/[\s@._-]+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase())
                      .join("") || "O"

                    return (
                      <div key={person.id || person.email} className="group rounded-2xl border border-white/[.07] bg-[#07101c]/75 p-4 transition hover:border-cyan-300/[.16] hover:bg-[#091523]">
                        <div className="flex items-start gap-3.5">
                          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-gradient-to-br from-cyan-300/[.12] to-violet-300/[.12] text-sm font-semibold text-cyan-100">
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-slate-100">{person.recipientName || person.email}</p>
                                {person.recipientName && <p className="mt-0.5 truncate text-xs text-slate-500">{person.email}</p>}
                              </div>
                              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${connected ? "border-cyan-300/20 bg-cyan-300/[.08] text-cyan-100" : "border-violet-300/20 bg-violet-300/[.08] text-violet-100"}`}>
                                {status}
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[.07] bg-white/[.025] px-2 py-1 text-slate-400">
                                {canEdit ? <PencilLine size={12} /> : <Eye size={12} />}
                                {canEdit ? "Can edit" : "View only"}
                              </span>
                              {person.relationship && (
                                <span className="rounded-lg border border-white/[.07] bg-white/[.025] px-2 py-1 text-slate-500">{person.relationship}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <AccessNote icon={<Eye size={16} />} title="View together" copy="View-only members can follow permitted shared records without changing them." tone="cyan" />
          <AccessNote icon={<PencilLine size={16} />} title="Work together" copy="Editors can update permitted shared records. Use this role only for people you trust." tone="violet" />
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SubscriptionSettings me={me} />
      <Card className="border-cyan-300/20 bg-cyan-300/[.045] p-5 text-white">
        <h2 className="mb-4 font-semibold">Profile</h2>
        <Label text="Your display name">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Your name" />
        </Label>
        <p className="mb-4 text-xs text-slate-500">This name appears beside your profile picture throughout Orbit LM.</p>
        <Button onClick={save}>Update profile</Button>
      </Card>
      <Card className="border-white/10 bg-white/5 p-5 text-white">
        <h2 className="mb-4 font-semibold">Country, language and currency</h2>
        <Label text="Country / market">
          <select
            value={country}
            onChange={(e) => {
              const c = e.target.value
              const m = markets.find((x) => x.code === c)!
              setCountry(c)
              setLanguage(m.language)
              setCurrency(m.currency)
            }}
          >
            {markets.map((x) => (
              <option key={x.code} value={x.code}>{x.flag} {x.name}</option>
            ))}
          </select>
        </Label>
        <Label text="Language">
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            {languages.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
          </select>
        </Label>
        <Label text="Default currency">
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {currencies.map((x) => <option key={x}>{x}</option>)}
          </select>
        </Label>
        <Button onClick={save}>Save preferences</Button>
      </Card>
      <Card className="border-white/10 bg-white/5 p-5 text-white">
        <details className="group">
          <summary className="cursor-pointer py-2 font-semibold text-cyan-100">Available markets</summary>
          <div className="mt-3">
            {markets.map((x) => <div key={x.code} className="mb-2 rounded-xl bg-black/20 p-3 text-sm">{x.flag} {x.name} · {x.currency}</div>)}
          </div>
        </details>
      </Card>
    </div>
  )
}

function Stat({ value, label, accent = "neutral" }: { value: number; label: string; accent?: "neutral" | "cyan" | "violet" }) {
  const valueClass = accent === "cyan" ? "text-cyan-200" : accent === "violet" ? "text-violet-200" : "text-white"
  return (
    <div className="rounded-2xl border border-white/[.08] bg-black/[.12] px-3 py-3 text-center">
      <p className={`text-xl font-semibold tracking-tight ${valueClass}`}>{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-[.12em] text-slate-500">{label}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-medium text-slate-400">
      <span className="mb-2 block">{label}</span>
      {children}
    </label>
  )
}

function AccessNote({ icon, title, copy, tone }: { icon: React.ReactNode; title: string; copy: string; tone: "cyan" | "violet" }) {
  const toneClass = tone === "cyan"
    ? "border-cyan-300/[.12] bg-cyan-300/[.035] text-cyan-200"
    : "border-violet-300/[.12] bg-violet-300/[.035] text-violet-200"
  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5">{icon}</span>
        <div>
          <p className="text-sm font-medium text-slate-200">{title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{copy}</p>
        </div>
      </div>
    </div>
  )
}

function Label({ text, children }: R) {
  return <label className="mb-4 block text-xs text-slate-400">{text}<div className="mt-2">{children}</div></label>
}
