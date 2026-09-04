"use client"

import { useEffect, useMemo } from "react"

export default function GoogleConnectedPage() {
  const target = useMemo(() => {
    if (typeof window === "undefined") return "/dashboard"
    const params = new URLSearchParams(window.location.search)
    const status = params.get("gmail") || "connected"
    const destination = params.get("return")
    const next = new URL("/dashboard", window.location.origin)
    next.searchParams.set("gmail", status)
    if (destination === "leads") next.searchParams.set("view", "leads")
    return next.pathname + next.search
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => window.location.replace(target), 50)
    return () => window.clearTimeout(timer)
  }, [target])

  return (
    <main className="grid min-h-screen place-items-center bg-[#050812] px-5 text-white">
      <div className="w-full max-w-md rounded-3xl border border-cyan-300/20 bg-[#091522] p-7 text-center shadow-[0_24px_80px_rgba(0,0,0,.35)]">
        <div className="mx-auto h-10 w-10 animate-pulse rounded-full border border-cyan-300/30 bg-cyan-300/10" />
        <h1 className="mt-5 text-xl font-semibold">Returning to Orbit…</h1>
        <p className="mt-2 text-sm text-slate-400">Your email connection is being finalized.</p>
      </div>
    </main>
  )
}
