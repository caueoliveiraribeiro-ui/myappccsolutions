"use client"

import { FormEvent, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Archive, FileText, Mail, X } from "lucide-react"
import { ArchiveManagerButton } from "@/components/archive-manager"
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
  // Interface labels are translated after render; the submit type stays stable.
  const saveButton = form.querySelector<HTMLButtonElement>('button[type="submit"]')
  if (!saveButton) return null

  let slot = form.querySelector<HTMLElement>(`[data-orbit-crm-email-action="${id}"]`)
  if (!slot) {
    slot = document.createElement("span")
    slot.dataset.orbitCrmEmailAction = id
    slot.dataset.orbitCrmEmailKind = kind
    slot.className = "inline-flex flex-wrap gap-2"
    saveButton.insertAdjacentElement("afterend", slot)
  }
  return slot
}

function addProjectArchiveSlot() {
  const summary = Array.from(document.querySelectorAll<HTMLElement>("summary")).find((node) => {
    const first = node.firstElementChild
    return first?.textContent?.trim() === "Create project"
  })
  const details = summary?.closest("details")
  if (!(details instanceof HTMLElement)) return null

  details.classList.add("relative")
  let slot = details.querySelector<HTMLElement>("[data-orbit-project-archive-menu]")
  if (!slot) {
    slot = document.createElement("span")
    slot.dataset.orbitProjectArchiveMenu = "true"
    slot.className = "absolute right-11 top-2 z-20 inline-flex"
    details.appendChild(slot)
  }
  return slot
}

export function CrmEmailActions() {
  const [targets, setTargets] = useState<EmailTarget[]>([])
  const [projectArchiveSlot, setProjectArchiveSlot] = useState<HTMLElement | null>(null)
  const [connection, setConnection] = useState<ConnectionState>({ connected: false, email: null })
  const [composer, setComposer] = useState<ComposerState | null>(null)
  const [to, setTo] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [archiving, setArchiving] = useState<string | null>(null)
  const [creatingInvoice, setCreatingInvoice] = useState<string | null>(null)

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
    let scanTimer: number | null = null

    const scan = () => {
      const next: EmailTarget[] = []
      if (document.querySelector('input[name="service_amount"]')) {
        document.querySelectorAll<HTMLFormElement>("details form").forEach((form, index) => {
          const isClient = Boolean(
            form.querySelector('input[name="email"]') &&
            form.querySelector('input[name="service_amount"]') &&
            form.querySelector('select[name="billing_frequency"]'),
          )
          if (!isClient) return
          const id = `client-${index}`
          const slot = addSlot(form, id, "client")
          if (slot) next.push({ id, slot, form, kind: "client" })
        })
      }

      if (document.querySelector('input[name="next_follow_up_date"]')) {
        document.querySelectorAll<HTMLFormElement>("details form").forEach((form, index) => {
          if (!form.querySelector('input[name="company"]')) return
            const description = form.querySelector<HTMLTextAreaElement>('textarea[name="description"]')?.closest("label")
            const notes = form.querySelector<HTMLTextAreaElement>('textarea[name="notes"]')?.closest("label")
            const status = form.querySelector<HTMLSelectElement>('select[name="status"]')?.closest("label")
            if (
              description &&
              notes &&
              status &&
              description.parentElement === notes.parentElement &&
              description.parentElement === status.parentElement &&
              status.nextElementSibling !== description
            ) {
              status.insertAdjacentElement("afterend", description)
            }

            const id = `pipeline-${index}`
            const slot = addSlot(form, id, "pipeline")
            if (slot) next.push({ id, slot, form, kind: "pipeline" })
        })
      }

      if (document.querySelector('input[name="contact_email"]')) {
        document.querySelectorAll<HTMLFormElement>("form").forEach((form, index) => {
          const isProject = Boolean(
            form.querySelector('input[name="contact_email"]') &&
            form.querySelector('select[name="stage"]') &&
            form.querySelector('input[name="name"]'),
          )
          if (!isProject) return

          const paymentNotes = form.querySelector<HTMLTextAreaElement>('textarea[name="payment_notes"]')?.closest("label")
          if (paymentNotes instanceof HTMLElement && !paymentNotes.hidden) paymentNotes.hidden = true
          form.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
            if (button.textContent?.trim() === "Delete history project") button.textContent = "Delete project"
          })

          const id = `project-${index}`
          const slot = addSlot(form, id, "project")
          if (slot) next.push({ id, slot, form, kind: "project" })
        })
        setProjectArchiveSlot((current) => {
          const slot = addProjectArchiveSlot()
          return current === slot ? current : slot
        })
      } else {
        setProjectArchiveSlot((current) => current ? null : current)
      }

      setTargets((current) => {
        if (
          current.length === next.length &&
          current.every((item, index) => item.slot === next[index]?.slot && item.form === next[index]?.form)
        ) return current
        return next
      })
    }

    const schedule = (delay = 100) => {
      if (scanTimer) window.clearTimeout(scanTimer)
      scanTimer = window.setTimeout(() => {
        scanTimer = null
        scan()
      }, delay)
    }

    scan()
    const interval = window.setInterval(scan, 1800)
    const onClick = () => {
      schedule(80)
      window.setTimeout(() => schedule(60), 420)
    }
    const onFocus = () => schedule(50)
    const onVisibility = () => document.visibilityState === "visible" && schedule(50)
    document.addEventListener("click", onClick, true)
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      if (scanTimer) window.clearTimeout(scanTimer)
      window.clearInterval(interval)
      document.removeEventListener("click", onClick, true)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibility)
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

  async function archiveTarget(target: EmailTarget) {
    if (target.kind === "pipeline" || archiving) return
    const resource = target.kind === "client" ? "clients" : "projects"
    const singular = target.kind === "client" ? "client" : "project"
    setArchiving(target.id)

    try {
      const activeResponse = await fetch(`/api/data/${resource}`, { cache: "no-store" })
      const activeData = await activeResponse.json().catch(() => ({}))
      if (!activeResponse.ok) throw new Error(activeData.error || `Could not load this ${singular}.`)

      const rows = activeData.items || []
      let row: Record<string, any> | undefined
      if (target.kind === "client") {
        const email = fieldValue(target.form, "email").toLowerCase()
        const name = fieldValue(target.form, "name").toLowerCase()
        const company = fieldValue(target.form, "company_name").toLowerCase()
        row = rows.find((item: Record<string, any>) => {
          const sameEmail = email && String(item.email || "").trim().toLowerCase() === email
          const sameName = name && String(item.name || "").trim().toLowerCase() === name
          const sameCompany = company && String(item.company_name || "").trim().toLowerCase() === company
          return sameEmail || (sameName && (!company || sameCompany))
        })
      } else {
        const name = fieldValue(target.form, "name").toLowerCase()
        const client = fieldValue(target.form, "client").toLowerCase()
        row = rows.find((item: Record<string, any>) =>
          String(item.name || "").trim().toLowerCase() === name &&
          String(item.client || "").trim().toLowerCase() === client,
        )
      }

      if (!row) throw new Error(`Could not identify this ${singular}. Refresh and try again.`)
      if (!confirm(`Archive ${row.name || `this ${singular}`}? You can restore it from the reserved archive.`)) return

      const response = await fetch(`/api/archive/${resource}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: row.id, archived: true }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || `Could not archive this ${singular}.`)

      toast.success(`${singular === "client" ? "Client" : "Project"} archived.`)
      window.dispatchEvent(new CustomEvent("orbit:records-changed", {detail:{resource}}))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Could not archive this ${singular}.`)
    } finally {
      setArchiving(null)
    }
  }

  async function createProjectInvoice(target: EmailTarget) {
    if (target.kind !== "project" || creatingInvoice) return
    const projectName = fieldValue(target.form, "name")
    const clientName = fieldValue(target.form, "client") || projectName
    const clientEmail = fieldValue(target.form, "contact_email")
    const amount = Number(fieldValue(target.form, "budget"))
    if (!projectName || !Number.isFinite(amount) || amount < 0) {
      toast.error("Add a project name and a valid project value before creating its invoice.")
      return
    }

    setCreatingInvoice(target.id)
    try {
      const [projectResponse, clientResponse] = await Promise.all([
        fetch("/api/data/projects", { cache: "no-store" }),
        fetch("/api/data/clients", { cache: "no-store" }),
      ])
      const projects = projectResponse.ok ? (await projectResponse.json()).items || [] : []
      const clients = clientResponse.ok ? (await clientResponse.json()).items || [] : []
      const project = projects.find((item: Record<string, unknown>) =>
        String(item.name || "").trim() === projectName &&
        String(item.client || "").trim() === fieldValue(target.form, "client"),
      )
      const client = clients.find((item: Record<string, unknown>) =>
        String(item.email || "").trim().toLowerCase() === clientEmail.toLowerCase() ||
        String(item.name || item.company_name || "").trim().toLowerCase() === clientName.toLowerCase(),
      )
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: typeof project?.id === "string" ? project.id : undefined,
          client_id: typeof client?.id === "string" ? client.id : undefined,
          client_name: clientName,
          client_email: clientEmail || undefined,
          client_address: String(client?.address || ""),
          service_name: fieldValue(target.form, "kind") || "Professional services",
          description: fieldValue(target.form, "description") || `Invoice for ${projectName}`,
          amount,
          currency: fieldValue(target.form, "currency") || String(project?.currency || "USD"),
          issue_date: new Date().toISOString().slice(0, 10),
          due_date: fieldValue(target.form, "deadline") || undefined,
          status: "draft",
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "The invoice could not be created.")
      toast.success(`Invoice ${data.invoice?.invoice_number || "draft"} created from this project.`)
      window.dispatchEvent(new CustomEvent("orbit:open-invoices"))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The invoice could not be created.")
    } finally {
      setCreatingInvoice(null)
    }
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
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => openComposer(target)}
            title={connection.connected ? "Send email" : "Connect an email account first"}
          >
            <Mail size={15} />
            Email
          </Button>
          {target.kind !== "pipeline" && (
            <Button
              type="button"
              variant="outline"
              disabled={archiving !== null}
              className="border-amber-300/25 text-amber-100"
              onClick={() => void archiveTarget(target)}
            >
              <Archive size={15} />
              {archiving === target.id ? "Archiving…" : target.kind === "client" ? "Archive client" : "Archive project"}
            </Button>
          )}
          {target.kind === "project" && (
            <Button
              type="button"
              variant="outline"
              disabled={creatingInvoice !== null}
              className="border-cyan-300/35 text-cyan-100 hover:bg-cyan-300/10"
              onClick={() => void createProjectInvoice(target)}
            >
              <FileText size={15} />
              {creatingInvoice === target.id ? "Creating invoice…" : "Create invoice"}
            </Button>
          )}
        </>,
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
