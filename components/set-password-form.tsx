"use client"

import { FormEvent, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export function SetPasswordForm({
  token,
}: {
  token: string
}) {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] =
    useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [complete, setComplete] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError("")

    if (password.length < 12 || password.length > 128) {
      setError(
        "Your password must be between 12 and 128 characters."
      )
      return
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.")
      return
    }

    setBusy(true)

    try {
      const response = await fetch(
        "/api/auth/set-password",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            token,
            password,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error || "Password could not be saved."
        )
      }

      setComplete(true)
      setPassword("")
      setConfirmPassword("")
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Password could not be saved."
      )
    } finally {
      setBusy(false)
    }
  }

  if (complete) {
    return (
      <Card className="w-full max-w-lg rounded-3xl border-cyan-300/30 bg-gradient-to-br from-[#102835] to-[#211c36] p-7 text-white sm:p-10">
        <p className="text-sm uppercase tracking-widest text-cyan-200">
          Orbit LM
        </p>

        <h1 className="mt-4 text-3xl font-semibold">
          Your password is ready
        </h1>

        <p className="mt-5 leading-7 text-slate-300">
          Your Orbit password has been securely created.
          You can now sign in using the email you used
          during Stripe checkout.
        </p>

        <a
          href="/"
          className="mt-7 inline-block rounded-xl bg-cyan-200 px-5 py-3 font-semibold text-slate-950"
        >
          Sign in to Orbit
        </a>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-lg rounded-3xl border-cyan-300/30 bg-gradient-to-br from-[#102835] to-[#211c36] p-7 text-white sm:p-10">
      <p className="text-sm uppercase tracking-widest text-cyan-200">
        Orbit LM · Account setup
      </p>

      <h1 className="mt-4 text-3xl font-semibold">
        Create your password
      </h1>

      <p className="mt-4 leading-7 text-slate-300">
        Your purchase has been received. Create the password
        you will use to sign in to Orbit.
      </p>

      <form
        onSubmit={submit}
        className="mt-7 space-y-5"
      >
        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-sm text-slate-200"
          >
            New password
          </label>

          <input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            className="w-full rounded-xl border border-cyan-200/20 bg-black/20 px-4 py-3 text-white outline-none focus:border-cyan-300"
          />

          <p className="mt-2 text-xs text-slate-400">
            Use at least 12 characters.
          </p>
        </div>

        <div>
          <label
            htmlFor="confirm-password"
            className="mb-2 block text-sm text-slate-200"
          >
            Confirm password
          </label>

          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
            value={confirmPassword}
            onChange={(event) =>
              setConfirmPassword(event.target.value)
            }
            className="w-full rounded-xl border border-cyan-200/20 bg-black/20 px-4 py-3 text-white outline-none focus:border-cyan-300"
          />
        </div>

        <Button
          type="submit"
          disabled={busy}
          className="w-full"
        >
          {busy
            ? "Saving password…"
            : "Create my password"}
        </Button>
      </form>

      {error && (
        <p
          role="alert"
          className="mt-5 text-sm text-cyan-100"
        >
          {error}
        </p>
      )}
    </Card>
  )
}