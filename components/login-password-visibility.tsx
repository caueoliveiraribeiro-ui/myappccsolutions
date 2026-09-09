"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Eye, EyeOff } from "lucide-react"

export function LoginPasswordVisibility() {
  const [input, setInput] = useState<HTMLInputElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const findPasswordField = () => {
      const next = document.querySelector<HTMLInputElement>('main.orbit-home input[name="password"]')
      if (next !== input) setInput(next)
    }
    findPasswordField()
    const timer = window.setInterval(findPasswordField, 400)
    return () => window.clearInterval(timer)
  }, [input])

  useEffect(() => {
    if (!input) return
    input.classList.add("pr-12")
    const label = input.closest("label")
    label?.classList.add("relative")
    return () => input.classList.remove("pr-12")
  }, [input])

  if (!input) return null
  const label = input.closest("label")
  if (!label) return null

  return createPortal(
    <button
      type="button"
      aria-label={visible ? "Hide password" : "Show password"}
      aria-pressed={visible}
      title={visible ? "Hide password" : "Show password"}
      className="absolute bottom-2.5 right-2.5 grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-cyan-300/10 hover:text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
      onClick={() => {
        const next = !visible
        input.type = next ? "text" : "password"
        setVisible(next)
        input.focus()
      }}
    >
      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>,
    label,
  )
}
