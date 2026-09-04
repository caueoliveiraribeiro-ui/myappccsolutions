"use client"

import { FormEvent, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [complete, setComplete] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    if (password.length < 12 || password.length > 128) return setError("Use a password between 12 and 128 characters.")
    if (password !== confirmPassword) return setError("The passwords do not match.")

    setBusy(true)
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Password could not be reset.")
      setComplete(true)
      setPassword("")
      setConfirmPassword("")
    } catch (error) {
      setError(error instanceof Error ? error.message : "Password could not be reset.")
    } finally {
      setBusy(false)
    }
  }

  if (complete) {
    return (
      <Card className="w-full max-w-lg rounded-3xl border-cyan-300/30 bg-gradient-to-br from-[#102835] to-[#211c36] p-7 text-white sm:p-10">
        <p className="text-sm uppercase tracking-widest text-cyan-200">Orbit LM</p>
        <h1 className="mt-4 text-3xl font-semibold">Password reset complete</h1>
        <p className="mt-5 leading-7 text-slate-300">Your password has been changed. Sign in again with your new password.</p>
        <a href="/" className="mt-7 inline-block rounded-xl bg-cyan-200 px-5 py-3 font-semibold text-slate-950">Sign in to Orbit</a>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-lg rounded-3xl border-cyan-300/30 bg-gradient-to-br from-[#102835] to-[#211c36] p-7 text-white sm:p-10">
      <p className="text-sm uppercase tracking-widest text-cyan-200">Orbit LM · Secure reset</p>
      <h1 className="mt-4 text-3xl font-semibold">Choose a new password</h1>
      <p className="mt-4 leading-7 text-slate-300">This one-time reset link expires after 30 minutes.</p>
      <form onSubmit={submit} className="mt-7 space-y-5">
        <label className="block text-sm text-slate-200">New password
          <input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-cyan-200/20 bg-black/20 px-4 py-3 text-white outline-none focus:border-cyan-300" />
        </label>
        <label className="block text-sm text-slate-200">Confirm password
          <input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-cyan-200/20 bg-black/20 px-4 py-3 text-white outline-none focus:border-cyan-300" />
        </label>
        <Button type="submit" disabled={busy} className="h-12 w-full">{busy ? "Saving…" : "Reset password"}</Button>
      </form>
      {error && <p role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
    </Card>
  )
}
