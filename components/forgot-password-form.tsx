"use client"

import { FormEvent, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage("")
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await response.json()
      setMessage(data.message || "If an Orbit account exists for this email, a password reset link has been sent.")
    } catch {
      setMessage("If an Orbit account exists for this email, a password reset link has been sent.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="w-full max-w-lg rounded-3xl border-cyan-300/30 bg-gradient-to-br from-[#102835] to-[#211c36] p-7 text-white sm:p-10">
      <p className="text-sm uppercase tracking-widest text-cyan-200">Orbit LM · Account recovery</p>
      <h1 className="mt-4 text-3xl font-semibold">Forgot your password?</h1>
      <p className="mt-4 leading-7 text-slate-300">Enter your Orbit email. If an account exists, we’ll send a one-time reset link.</p>
      <form onSubmit={submit} className="mt-7 space-y-5">
        <label className="block text-sm text-slate-200">Email
          <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 h-12" />
        </label>
        <Button type="submit" disabled={busy} className="h-12 w-full">{busy ? "Sending…" : "Send reset link"}</Button>
      </form>
      {message && <p role="status" className="mt-5 rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm text-cyan-100">{message}</p>}
      <a href="/" className="mt-6 inline-block text-sm text-cyan-200 underline">Back to sign in</a>
    </Card>
  )
}
