"use client"

import { useEffect, useState } from "react"
import { Lightbulb, X } from "lucide-react"

export function OrbitImprovementPrompt() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!window.location.pathname.startsWith("/dashboard")) return
    const timer = window.setTimeout(() => setOpen(true), 900)
    return () => window.clearTimeout(timer)
  }, [])

  function close() {
    setOpen(false)
  }

  if (!open) return null
  return <div className="fixed inset-0 z-[140] grid place-items-center bg-[#02030a]/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Share an Orbit idea">
    <section className="relative w-full max-w-md overflow-hidden rounded-[26px] border border-cyan-300/25 bg-[#07111f] p-6 text-white shadow-[0_28px_90px_rgba(0,0,0,.5)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(34,211,238,.20),transparent_34%),radial-gradient(circle_at_100%_95%,rgba(167,139,250,.18),transparent_38%)]"/>
      <button type="button" onClick={(event) => { event.stopPropagation(); close() }} aria-label="Close" className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-slate-300 hover:bg-white/10"><X size={16}/></button>
      <div className="relative"><div className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan-200/30 bg-cyan-300/[.12] text-cyan-100 shadow-[0_0_25px_rgba(34,211,238,.16)]"><Lightbulb size={22}/></div><p className="mt-5 text-[10px] font-semibold uppercase tracking-[.2em] text-cyan-200">You help shape Orbit</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Got an idea for Orbit LM?</h2><p className="mt-3 text-sm leading-6 text-slate-300">Orbit is always improving. If something would make your life or business easier, send us your idea anytime — we read every message.</p><div className="mt-6 flex gap-3"><button type="button" onClick={() => { close(); window.dispatchEvent(new Event("orbit:open-support")) }} className="h-10 flex-1 rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-slate-950 hover:bg-cyan-200">Share an idea</button><button type="button" onClick={close} className="h-10 rounded-xl border border-white/10 px-4 text-sm text-slate-300 hover:bg-white/5">Later</button></div></div>
    </section>
  </div>
}

