"use client"

import { FormEvent, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Mail, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

type Kind = "client" | "pipeline" | "project"

type EmailTarget = {
  id: string
  slot: HTMLElement
  form: HTMLFormElement
  kind: Kind
}

type ConnectionState = {
  connected: boolean
  email: string | null
}

type ComposerState = {
  to: string
  subject: string
  label: string
}

function fieldValue(form: HTMLFormElement, name: string) {
  const field = form.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[name="${name}"]`)
  return field?.value?.trim() || ""
}

function addSlot(form: HTMLFormElement, id: string, kind: Kind) {
  const saveButton = Array.from(form.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent?.trim() === "Save changes",
  )
  if (!saveButton) return null

  let slot = form.querySelector<HTMLElement>(`[data-orbit-crm-email-action="${id}"]`)
  if (!slot) {
    slot = document.createElement("span")
    slot.dataset.orbitCrmEmailAction = id
    slot.dataset.orbitCrmEmailKind = kind
    slot.className = "inline-flex"
    saveButton.insertAdjacentElement("afterend", slot)
  }
  return slot
}

export function CrmEmailActions() {
  const [targets, setTargets] = useState<EmailTarget[]>([])
  const [connection, setConnection] = useState<ConnectionState>({ connected: false, email: null })
  const [composer, setComposer] = useState<ComposerState | null>(null)
  const [to, setTo] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)

  async function refreshConnection() {
    try {
      const response = await fetch("/api/google/connection", { cache: "no-store" })
      if (!response.ok) return
      const data = await response.json()
      setConnection({ connected: Boolean(data.connected), email: data.email || null })
    } catch {}
  }

  useEffect(() => {
    void refreshConnection()
    const onFocus = () => void refreshConnection()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [])

  useEffect(() => {
    const scan = () => {
      const next: EmailTarget[] = []

      // Clients → Client directory → each client dropdown.
      const clientHeading = Array.from(document.querySelectorAll("h2")).find(
        (node) => node.textContent?.trim() === "Client directory",
      )
      const clientPanel = clientHeading?.closest("[data-slot='card']") || clientHeading?.parentElement?.parentElement
      if (clientPanel instanceof HTMLElement) {
        clientPanel.querySelectorAll<HTMLFormElement>("details form").forEach((form, index) => {
          const id = `client-${index}`
          const slot = addSlot(form, id, "client")
          if (slot) next.push({ id, slot, form, kind: "client" })
        })
      }

      // Pipeline → Lead history → each lead/client history dropdown.
      const pipelineHeading = Array.from(document.querySelectorAll("h2")).find(
        (node) => node.textContent?.trim() === "Lead history",
      )
      const pipelinePanel = pipelineHeading?.closest("[data-slot='card']") || pipelineHeading?.parentElement?.parentElement
      if (pipelinePanel instanceof HTMLElement) {
        pipelinePanel.querySelectorAll<HTMLFormElement>("details form").forEach((form, index) => {
          // Keep Description directly below Status and immediately above Management notes.
          const description = form.querySelector<HTMLTextAreaElement>('textarea[name="description"]')?.closest("label")
          const notes = form.querySelector<HTMLTextAreaElement>('textarea[name="notes"]')?.closest("label")
          if (description && notes && description.parentElement === notes.parentElement) {
            notes.parentElement?.insertBefore(description, notes)
          }

          const id = `pipeline-${index}`
          const slot = addSlot(form, id, "pipeline")
          if (slot) next.push({ id, slot, form, kind: "pipeline" })
        })
      }

      // Projects → active projects and project history dropdowns.
      document.querySelectorAll<HTMLFormElement>("form").forEach((form, index) => {
        const isProject = Boolean(
          form.querySelector('input[name="contact_email"]') &&
          form.querySelector('select[name="stage"]') &&
          form.querySelector('input[name="name"]'),
        )
        if (!isProject) return

        // Payment notes are no longer part of the project information UI.
        const paymentNotes = form.querySelector<HTMLTextAreaElement>('textarea[name="payment_notes"]')?.closest("label")
        if (paymentNotes instanceof HTMLElement) paymentNotes.hidden = true

        const id = `project-${index}`
        const slot = addSlot(form, id, "project")
        if (slot) next.push({ id, slot, form, kind: "project" })
      })

      setTargets((current) => {
        if (
          current.length === next.length &&
          current.every((item, index) => item.slot === next[index]?.slot && item.form === next[index]?.form)
        ) return current
        return next
      })
    }

    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true })
    const timer = window.setInterval(scan, 800)
    return () => {
      observer.disconnect()
      window.clearInterval(timer)
    }
  }, [])

  function openComposer(target: EmailTarget) {
    if (!connection.connected) {
      toast.error("Connect your email account from Leads Management → Lead directory first.")
      return
    }

    const form = target.form
    let recipient = ""
    let label = ""
    let defaultSubject = ""

    if (target.kind === "client") {
      recipient = fieldValue(form, "email")
      label = fieldValue(form, "company_name") || fieldValue(form, "name") || "your client"
      defaultSubject = `A quick note for ${label}`
    } else if (target.kind === "pipeline") {
      recipient = fieldValue(form, "email")
      label = fieldValue(form, "company") || fieldValue(form, "contact_name") || "this lead"
      defaultSubject = `A quick note for ${label}`
    } else {
      recipient = fieldValue(form, "contact_email")
      label = fieldValue(form, "client") || fieldValue(form, "name") || "this project"
      const projectName = fieldValue(form, "name")
      defaultSubject = projectName ? `Regarding ${projectName}` : `A quick note for ${label}`
    }

    setComposer({ to: recipient, subject: defaultSubject, label })
    setTo(recipient)
    setSubject(defaultSubject)
    setMessage("")
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!to.trim() || !subject.trim() || !message.trim()) return

    setSending(true)
    try {
      const response = await fetch("/api/google/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: to.trim(), subject: subject.trim(), message }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Unable to send email.")
      toast.success("Email sent")
      setComposer(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send email.")
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {targets.map((target) => createPortal(
        <Button
          type="button"
          variant="outline"
          onClick={() => openComposer(target)}
          title={connection.connected ? "Send email" : "Connect an email account first"}
        >
          <Mail size={15} />
          Email
        </Button>,
        target.slot,
        target.id,
      ))}

      {composer && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4">
          <Card className="w-full max-w-xl border-white/10 bg-[#0b1320] p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,.55)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">New email</h2>
                <p className="mt-1 text-xs text-slate-500">Send directly from your connected email account.</p>
              </div>
              <button type="button" aria-label="Close email composer" onClick={() => setComposer(null)} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white">
                <X size={19} />
              </button>
            </div>

            <form onSubmit={send} className="mt-4 space-y-3">
              <label className="block text-xs text-slate-400">From
                <Input value={connection.email || "Connected email account"} readOnly className="mt-1" />
              </label>
              <label className="block text-xs text-slate-400">To
                <Input type="email" required value={to} onChange={(event) => setTo(event.target.value)} className="mt-1" placeholder="client@example.com" />
              </label>
              <label className="block text-xs text-slate-400">Subject
                <Input required value={subject} onChange={(event) => setSubject(event.target.value)} className="mt-1" />
              </label>
              <label className="block text-xs text-slate-400">Email
                <Textarea required rows={8} value={message} onChange={(event) => setMessage(event.target.value)} className="mt-1" placeholder={`Write a message for ${composer.label}…`} />
              </label>
              <Button disabled={sending} className="w-full">
                {sending ? "Sending…" : "Send email"}
              </Button>
            </form>
          </Card>
        </div>
      )}
    </>
  )
}
