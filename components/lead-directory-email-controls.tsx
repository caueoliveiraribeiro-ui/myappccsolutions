"use client"

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { Mail, PlugZap, Unplug } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

type ConnectionState = {
  connected: boolean
  email: string | null
}

function ConnectionButtons({
  status,
  loading,
  compact = false,
  disconnect,
}: {
  status: ConnectionState
  loading: boolean
  compact?: boolean
  disconnect: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status.connected && status.email && (
        <div className={compact
          ? "flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1.5 text-[11px] text-emerald-100"
          : "flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs text-emerald-100"}
        >
          <Mail size={14} />
          <span className={compact ? "max-w-[180px] truncate" : "max-w-[240px] truncate"}>{status.email}</span>
        </div>
      )}

      {!status.connected ? (
        <Button asChild size="sm" className="bg-cyan-300 text-slate-950">
          <a href="/api/google/connect?return=leads">
            <PlugZap size={15} />
            Connect email account
          </a>
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={disconnect}
          className="border-red-400/30 text-red-200 hover:bg-red-400/10"
        >
          <Unplug size={15} />
          {loading ? "Disconnecting…" : "Disconnect email"}
        </Button>
      )}
    </div>
  )
}

export function LeadDirectoryEmailControls() {
  const [headerTarget, setHeaderTarget] = useState<HTMLElement | null>(null)
  const [leadTargets, setLeadTargets] = useState<HTMLElement[]>([])
  const [status, setStatus] = useState<ConnectionState>({ connected: false, email: null })
  const [loading, setLoading] = useState(false)

  async function refreshStatus() {
    try {
      const response = await fetch("/api/google/connection", { cache: "no-store" })
      if (!response.ok) return
      const data = await response.json()
      setStatus({ connected: Boolean(data.connected), email: data.email || null })
    } catch {}
  }

  useEffect(() => {
    void refreshStatus()

    const params = new URLSearchParams(window.location.search)
    const shouldOpenLeads = window.location.pathname === "/dashboard" && params.get("view") === "leads"
    const gmailStatus = params.get("gmail")
    let openedLeads = false

    const locate = () => {
      if (shouldOpenLeads && !openedLeads) {
        const leadNav = Array.from(document.querySelectorAll("button, a")).find(
          (node) => node.textContent?.trim() === "Leads Management",
        ) as HTMLElement | undefined
        if (leadNav) {
          openedLeads = true
          leadNav.click()
          const clean = new URL(window.location.href)
          clean.searchParams.delete("view")
          window.history.replaceState({}, "", clean.pathname + (clean.searchParams.size ? `?${clean.searchParams}` : ""))
          if (gmailStatus === "connected") toast.success("Email account connected")
        }
      }

      const heading = Array.from(document.querySelectorAll("h2")).find(
        (node) => node.textContent?.trim() === "Lead directory",
      )
      if (!heading) {
        setHeaderTarget(null)
        setLeadTargets([])
        return
      }

      const panel = heading.closest("[data-slot='card']") || heading.parentElement?.parentElement
      if (!(panel instanceof HTMLElement)) return

      let slot = panel.querySelector<HTMLElement>("[data-orbit-lead-email-controls='true']")
      if (!slot) {
        slot = document.createElement("div")
        slot.dataset.orbitLeadEmailControls = "true"
        slot.className = "mb-4 flex flex-wrap items-center justify-end gap-2"
        const headingRow = heading.parentElement
        if (headingRow && headingRow !== panel) {
          headingRow.appendChild(slot)
        } else {
          heading.insertAdjacentElement("afterend", slot)
        }
      }
      setHeaderTarget(slot)

      const inlineSlots: HTMLElement[] = []
      panel.querySelectorAll("details form").forEach((form, index) => {
        const actionRow = Array.from(form.querySelectorAll<HTMLElement>("div")).find((div) =>
          Array.from(div.querySelectorAll("button")).some((button) => button.textContent?.trim() === "Email"),
        )
        if (!actionRow) return

        let inline = actionRow.querySelector<HTMLElement>("[data-orbit-lead-inline-email-controls='true']")
        if (!inline) {
          inline = document.createElement("div")
          inline.dataset.orbitLeadInlineEmailControls = "true"
          inline.dataset.orbitLeadIndex = String(index)
          inline.className = "flex flex-wrap items-center gap-2"
          actionRow.appendChild(inline)
        }
        inlineSlots.push(inline)
      })
      setLeadTargets((current) => {
        if (current.length === inlineSlots.length && current.every((item, index) => item === inlineSlots[index])) return current
        return inlineSlots
      })
    }

    locate()
    const observer = new MutationObserver(locate)
    observer.observe(document.body, { childList: true, subtree: true })
    const timer = window.setInterval(locate, 750)
    return () => {
      observer.disconnect()
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    const heading = Array.from(document.querySelectorAll("h2")).find(
      (node) => node.textContent?.trim() === "Lead directory",
    )
    const panel = heading?.closest("[data-slot='card']") || heading?.parentElement?.parentElement
    if (!panel) return

    panel.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      if (button.textContent?.trim() !== "Email") return
      button.disabled = !status.connected
      button.title = status.connected ? "Send email with your connected account" : "Connect an email account first"
      button.setAttribute("aria-disabled", status.connected ? "false" : "true")
    })
  }, [status.connected, leadTargets])

  async function disconnect() {
    setLoading(true)
    try {
      const response = await fetch("/api/google/connection", { method: "DELETE" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Could not disconnect email account.")
      setStatus({ connected: false, email: null })
      toast.success("Email account disconnected")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disconnect email account.")
    } finally {
      setLoading(false)
    }
  }

  const portals = useMemo(() => {
    const output = []
    if (headerTarget) {
      output.push(createPortal(
        <ConnectionButtons status={status} loading={loading} disconnect={() => void disconnect()} />,
        headerTarget,
        "lead-directory-email-header",
      ))
    }
    leadTargets.forEach((target, index) => {
      output.push(createPortal(
        <ConnectionButtons compact status={status} loading={loading} disconnect={() => void disconnect()} />,
        target,
        `lead-directory-email-${index}`,
      ))
    })
    return output
  }, [headerTarget, leadTargets, status, loading])

  return <>{portals}</>
}
