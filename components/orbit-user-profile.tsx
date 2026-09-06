"use client"

import { FormEvent, useEffect, useRef, useState } from "react"
import { Camera, KeyRound, MapPin, ShieldCheck, UserRound, X } from "lucide-react"
import { toast } from "sonner"

type Profile = Record<string, any>
const countries = [["US","United States"],["BR","Brazil"],["GB","United Kingdom"],["CA","Canada"],["AU","Australia"],["PT","Portugal"],["ES","Spain"],["DE","Germany"],["FR","France"],["IT","Italy"],["NL","Netherlands"],["CH","Switzerland"],["JP","Japan"],["KR","South Korea"],["MX","Mexico"]]
const languages = [["en","English"],["pt","Português"],["es","Español"],["de","Deutsch"],["fr","Français"],["it","Italiano"],["nl","Nederlands"],["ja","日本語"],["ko","한국어"]]
const currencies = ["USD","BRL","EUR","GBP","CAD","AUD","JPY","KRW","MXN","CHF"]

function initials(name: string) {
  return (name || "OU").split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase()
}

export function OrbitUserProfile() {
  const [open, setOpen] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [saving, setSaving] = useState(false)
  const [passwordBusy, setPasswordBusy] = useState(false)
  const triggerRef = useRef<HTMLElement | null>(null)

  async function load() {
    const r = await fetch("/api/me", { cache: "no-store" })
    if (!r.ok) return
    setProfile(await r.json())
  }

  function syncSidebar(next: Profile) {
    const card = triggerRef.current
    if (!card) return
    const nameNode = card.querySelector("b")
    const emailNode = card.querySelector("p")
    if (nameNode) nameNode.textContent = next.name || "Orbit member"
    if (emailNode) emailNode.textContent = next.email || ""
    const avatarBox = card.querySelector("label > div") as HTMLElement | null
    if (avatarBox && next.avatar_url) avatarBox.innerHTML = `<img src="${String(next.avatar_url).replaceAll('"','&quot;')}" alt="Profile avatar" class="h-full w-full object-cover" />`
    else if (avatarBox) avatarBox.textContent = initials(next.name)
  }

  function bindTrigger() {
    const input = document.querySelector('#orbit-navigation input[type="file"][accept="image/*"]') as HTMLInputElement | null
    const card = input?.closest("label")?.parentElement as HTMLElement | null
    if (!card || card.dataset.orbitProfileTrigger === "true") return
    card.dataset.orbitProfileTrigger = "true"
    card.setAttribute("role", "button")
    card.setAttribute("tabindex", "0")
    card.setAttribute("aria-label", "Open user profile")
    card.classList.add("cursor-pointer", "transition", "hover:border-cyan-300/30", "hover:bg-white/[.075]")
    triggerRef.current = card
    const activate = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
      load().then(() => setOpen(true)).catch(() => setOpen(true))
    }
    card.addEventListener("click", activate, true)
    card.addEventListener("keydown", (event) => {
      const keyEvent = event as KeyboardEvent
      if (keyEvent.key === "Enter" || keyEvent.key === " ") activate(event)
    })
  }

  useEffect(() => {
    load().catch(() => {})
    bindTrigger()
    const observer = new MutationObserver(bindTrigger)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!open) return
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", close)
    return () => window.removeEventListener("keydown", close)
  }, [open])

  async function uploadAvatar(file?: File) {
    if (!file) return
    const data = new FormData()
    data.append("avatar", file)
    const r = await fetch("/api/profile/avatar", { method: "POST", body: data })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) return toast.error(d.error || "We could not update your photo.")
    const next = { ...(profile || {}), avatar_url: d.avatar_url }
    setProfile(next)
    syncSidebar(next)
    toast.success("Profile photo updated.")
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!profile) return
    setSaving(true)
    const values = Object.fromEntries(new FormData(event.currentTarget))
    const r = await fetch("/api/profile/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    })
    const d = await r.json().catch(() => ({}))
    setSaving(false)
    if (!r.ok) return toast.error(d.error || "We could not save your profile.")
    const next = { ...profile, ...d }
    setProfile(next)
    syncSidebar(next)
    toast.success("Profile saved.")
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form)) as Record<string, string>
    if (values.newPassword !== values.confirmPassword) return toast.error("The new passwords do not match.")
    setPasswordBusy(true)
    const r = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
    })
    const d = await r.json().catch(() => ({}))
    setPasswordBusy(false)
    if (!r.ok) return toast.error(d.error || "We could not change your password.")
    form.reset()
    toast.success("Password changed securely.")
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[150] overflow-y-auto bg-black/80 p-3 backdrop-blur-md sm:p-6" role="dialog" aria-modal="true" aria-label="Orbit user profile">
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-[30px] border border-cyan-300/20 bg-[#06101c] text-white shadow-[0_30px_120px_rgba(0,0,0,.7)]">
        <div className="flex items-start justify-between border-b border-white/10 bg-gradient-to-r from-cyan-300/[.08] to-violet-300/[.06] p-5 sm:p-7">
          <div className="flex items-center gap-4">
            <label className="group relative grid h-20 w-20 cursor-pointer place-items-center overflow-hidden rounded-2xl border border-cyan-300/25 bg-gradient-to-br from-cyan-300 to-violet-300 text-2xl font-bold text-slate-950">
              {profile?.avatar_url ? <img src={profile.avatar_url} alt={profile?.name || "Profile"} className="h-full w-full object-cover" /> : initials(profile?.name || "")}
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/65 py-1 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100"><Camera size={11}/> Change</span>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => uploadAvatar(event.target.files?.[0])} />
            </label>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-cyan-200">Orbit profile</p>
              <h2 className="mt-1 text-2xl font-semibold">{profile?.name || "Your account"}</h2>
              <p className="mt-1 text-sm text-slate-400">{profile?.email}</p>
              <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-3 py-1 text-xs text-slate-300"><ShieldCheck size={13}/> {profile?.access?.plan && profile.access.plan !== "none" ? profile.access.plan.replaceAll("_", " ") : "Orbit account"}</div>
            </div>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-black/20 hover:bg-white/10" aria-label="Close profile"><X size={19}/></button>
        </div>

        <div className="grid gap-5 p-4 sm:p-6 xl:grid-cols-[1.5fr_.85fr]">
          <form onSubmit={saveProfile} className="space-y-5">
            <section className="rounded-2xl border border-white/10 bg-white/[.025] p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2"><UserRound size={17} className="text-cyan-200"/><h3 className="font-semibold">Personal & work details</h3></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Full name" name="name" required defaultValue={profile?.name}/>
                <Field label="Email" name="email_display" type="email" disabled defaultValue={profile?.email}/>
                <Field label="Phone" name="phone" defaultValue={profile?.phone}/>
                <Field label="Job title" name="job_title" defaultValue={profile?.job_title}/>
                <Field label="Company" name="company" defaultValue={profile?.company}/>
                <Field label="Website" name="website" type="url" defaultValue={profile?.website}/>
              </div>
              <label className="mt-3 block text-xs text-slate-400">About you<textarea name="bio" maxLength={500} defaultValue={profile?.bio || ""} rows={3} className="mt-1 w-full resize-y rounded-xl border border-white/10 bg-[#091522] px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40" placeholder="A short note about your role, priorities or workspace."/></label>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[.025] p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2"><MapPin size={17} className="text-cyan-200"/><h3 className="font-semibold">Address & regional preferences</h3></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Address line 1" name="address_line1" defaultValue={profile?.address_line1}/>
                <Field label="Address line 2" name="address_line2" defaultValue={profile?.address_line2}/>
                <Field label="City" name="city" defaultValue={profile?.city}/>
                <Field label="State / region" name="region" defaultValue={profile?.region}/>
                <Field label="Postal code" name="postal_code" defaultValue={profile?.postal_code}/>
                <label className="text-xs text-slate-400">Country<select name="country" defaultValue={profile?.country || "US"} className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#091522] px-3 text-sm">{countries.map(([code,label])=><option key={code} value={code}>{label}</option>)}</select></label>
                <label className="text-xs text-slate-400">Language<select name="language" defaultValue={profile?.language || "en"} className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#091522] px-3 text-sm">{languages.map(([code,label])=><option key={code} value={code}>{label}</option>)}</select></label>
                <label className="text-xs text-slate-400">Default currency<select name="currency" defaultValue={profile?.currency || "USD"} className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#091522] px-3 text-sm">{currencies.map((code)=><option key={code}>{code}</option>)}</select></label>
                <Field label="Time zone" name="timezone" defaultValue={profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone} placeholder="America/Sao_Paulo"/>
              </div>
            </section>

            <button type="submit" disabled={saving} className="h-11 w-full rounded-xl bg-cyan-300 px-5 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60">{saving ? "Saving…" : "Save profile changes"}</button>
          </form>

          <div className="space-y-5">
            <form onSubmit={changePassword} className="rounded-2xl border border-white/10 bg-white/[.025] p-4 sm:p-5">
              <div className="mb-2 flex items-center gap-2"><KeyRound size={17} className="text-cyan-200"/><h3 className="font-semibold">Security</h3></div>
              <p className="mb-4 text-xs leading-5 text-slate-500">Change your Orbit password without leaving the dashboard. Use at least 12 characters.</p>
              <div className="space-y-3">
                <Field label="Current password" name="currentPassword" type="password" required autoComplete="current-password"/>
                <Field label="New password" name="newPassword" type="password" required minLength={12} autoComplete="new-password"/>
                <Field label="Confirm new password" name="confirmPassword" type="password" required minLength={12} autoComplete="new-password"/>
              </div>
              <button type="submit" disabled={passwordBusy} className="mt-4 h-10 w-full rounded-xl border border-cyan-300/25 bg-cyan-300/[.08] px-4 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/[.14] disabled:opacity-60">{passwordBusy ? "Updating…" : "Change password"}</button>
            </form>

            <section className="rounded-2xl border border-white/10 bg-white/[.025] p-4 sm:p-5">
              <h3 className="font-semibold">Account overview</h3>
              <div className="mt-4 space-y-3 text-sm">
                <Info label="Account ID" value={profile?.id || "—"}/>
                <Info label="Plan" value={profile?.access?.plan ? String(profile.access.plan).replaceAll("_", " ") : "No plan"}/>
                <Info label="Access status" value={profile?.access?.status || "—"}/>
                <Info label="Currency" value={profile?.currency || "USD"}/>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, ...props }: { label: string; [key: string]: any }) {
  return <label className="text-xs text-slate-400">{label}<input {...props} className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#091522] px-3 text-sm text-white outline-none focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-60"/></label>
}

function Info({ label, value }: { label: string; value: any }) {
  return <div className="flex items-center justify-between gap-3 border-b border-white/[.06] pb-2"><span className="text-slate-500">{label}</span><span className="max-w-[60%] truncate capitalize text-slate-200">{String(value || "—")}</span></div>
}
