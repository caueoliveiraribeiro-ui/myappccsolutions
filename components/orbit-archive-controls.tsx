"use client"

import { useEffect, useRef, useState } from "react"
import { Archive, RotateCcw, X } from "lucide-react"
import { toast } from "sonner"

type Row = Record<string, any>
type ArchiveView = "clients" | "projects" | null

const buttonClass = "inline-flex h-9 items-center justify-center rounded-md border border-white/10 bg-white/[.04] px-3 text-xs font-medium text-slate-200 transition hover:bg-white/10"

export function OrbitArchiveControls() {
  const [clients, setClients] = useState<Row[]>([])
  const [projects, setProjects] = useState<Row[]>([])
  const [view, setView] = useState<ArchiveView>(null)
  const records = useRef({ clients: [] as Row[], projects: [] as Row[] })
  const scanTimer = useRef<number | null>(null)
  records.current = { clients, projects }

  async function refresh() {
    const [clientResponse, projectResponse] = await Promise.all([
      fetch("/api/data/clients", { cache: "no-store" }),
      fetch("/api/data/projects", { cache: "no-store" }),
    ])
    if (clientResponse.ok) setClients((await clientResponse.json()).items || [])
    if (projectResponse.ok) setProjects((await projectResponse.json()).items || [])
  }

  async function setArchived(resource: "clients" | "projects", row: Row, archived: boolean) {
    const r = await fetch(`/api/archive/${resource}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: row.id, archived }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) return toast.error(d.error || "We could not update the archive.")
    toast.success(archived ? `${resource === "clients" ? "Client" : "Project"} archived.` : `${resource === "clients" ? "Client" : "Project"} restored.`)
    await refresh()
    scheduleScan(40)
  }

  function clientFor(form: HTMLFormElement) {
    const email = (form.querySelector('input[name="email"]') as HTMLInputElement | null)?.value.trim().toLowerCase()
    const name = (form.querySelector('input[name="name"]') as HTMLInputElement | null)?.value.trim().toLowerCase()
    return records.current.clients.find((row) =>
      (email && String(row.email || "").trim().toLowerCase() === email && String(row.name || "").trim().toLowerCase() === name) ||
      (!email && String(row.name || "").trim().toLowerCase() === name),
    )
  }

  function projectFor(form: HTMLFormElement) {
    const name = (form.querySelector('input[name="name"]') as HTMLInputElement | null)?.value.trim().toLowerCase()
    const client = (form.querySelector('input[name="client"]') as HTMLInputElement | null)?.value.trim().toLowerCase()
    return records.current.projects.find((row) =>
      String(row.name || "").trim().toLowerCase() === name && String(row.client || "").trim().toLowerCase() === client,
    )
  }

  function addArchiveAction(form: HTMLFormElement, resource: "clients" | "projects", row: Row | undefined) {
    if (!row || row.archived) return

    const existingArchiveButton = Array.from(form.querySelectorAll("button")).find((button) =>
      /(^|\s)archive(\s|$)/i.test((button.textContent || "").trim()),
    )
    if (existingArchiveButton || form.querySelector(`[data-orbit-${resource}-archive-action]`)) return

    const submit = form.querySelector('button[type="submit"]') as HTMLButtonElement | null
    if (!submit?.parentElement) return
    const action = document.createElement("button")
    action.type = "button"
    action.dataset[`orbit${resource === "clients" ? "Clients" : "Projects"}ArchiveAction`] = "true"
    action.className = buttonClass
    action.textContent = resource === "clients" ? "Archive client" : "Archive project"
    action.addEventListener("click", async (event) => {
      event.preventDefault()
      const fresh = resource === "clients" ? clientFor(form) : projectFor(form)
      if (!fresh) return toast.error("We could not identify this record. Refresh and try again.")
      const current = resource === "clients" ? records.current.clients : records.current.projects
      if (current.filter((item) => item.archived).length >= 50) return toast.error(`The archived ${resource} list is full (50/50).`)
      if (!window.confirm(`Archive ${fresh.name || "this record"}? You can restore it from Archived ${resource}.`)) return
      await setArchived(resource, fresh, true)
    })
    const deleteButton = Array.from(submit.parentElement.querySelectorAll("button")).find((button) => /delete/i.test(button.textContent || ""))
    submit.parentElement.insertBefore(action, deleteButton || null)
  }

  function scan() {
    if (document.visibilityState === "hidden") return

    const title = (document.querySelector("h1")?.textContent || "").trim()
    const clientSearch = document.querySelector('input[placeholder="Search clients"]') as HTMLInputElement | null
    const onClients = Boolean(clientSearch)
    const onProjects = title === "Projects"
    const onSettings = title === "Settings"

    if (!onProjects) document.querySelector("[data-orbit-project-archive-header]")?.remove()
    if (!onClients && !onProjects && !onSettings) return

    if (onSettings) {
      document.querySelectorAll("section").forEach((section) => {
        if ((section.textContent || "").includes("Direct account lookup")) {
          ;(section as HTMLElement).hidden = true
        }
      })
      return
    }

    if (onClients && clientSearch) {
      const controls = clientSearch.closest("div.relative")?.parentElement
      if (controls && !controls.querySelector("[data-orbit-client-archive-trigger]")) {
        const trigger = document.createElement("button")
        trigger.type = "button"
        trigger.dataset.orbitClientArchiveTrigger = "true"
        trigger.className = buttonClass
        trigger.addEventListener("click", () => setView("clients"))
        const importButton = Array.from(controls.querySelectorAll("button")).find((button) => /import/i.test(button.textContent || ""))
        if (importButton?.nextSibling) controls.insertBefore(trigger, importButton.nextSibling)
        else controls.insertBefore(trigger, clientSearch.closest("div.relative"))
      }
      const trigger = controls?.querySelector("[data-orbit-client-archive-trigger]") as HTMLButtonElement | null
      if (trigger) trigger.textContent = `Archived clients (${records.current.clients.filter((row) => row.archived).length}/50)`

      document.querySelectorAll("form").forEach((node) => {
        const form = node as HTMLFormElement
        const isClient = Boolean(form.querySelector('input[name="company_name"]') && form.querySelector('input[name="service_amount"]') && form.querySelector('input[name="email"]'))
        if (!isClient) return
        const row = clientFor(form)
        const details = form.closest("details") as HTMLElement | null
        if (details && row) details.hidden = Boolean(row.archived)
        addArchiveAction(form, "clients", row)
      })
      return
    }

    if (onProjects) {
      document.querySelectorAll('textarea[name="payment_notes"]').forEach((textarea) => {
        const label = textarea.closest("label") as HTMLElement | null
        if (label && !label.hidden) label.hidden = true
      })

      document.querySelectorAll("form").forEach((node) => {
        const form = node as HTMLFormElement
        const isProject = Boolean(form.querySelector('input[name="budget"]') && form.querySelector('select[name="stage"]') && form.querySelector('input[name="client"]'))
        if (!isProject) return
        const row = projectFor(form)
        const details = form.closest("details") as HTMLElement | null
        if (details && row) details.hidden = Boolean(row.archived)
        addArchiveAction(form, "projects", row)
      })

      const existingProjectHeader = document.querySelector("[data-orbit-project-archive-header]")
      if (!existingProjectHeader) {
        const pageTitle = Array.from(document.querySelectorAll("h1")).find((el) => (el.textContent || "").trim() === "Projects")
        const header = pageTitle?.closest("header")
        if (header) {
          const box = document.createElement("div")
          box.dataset.orbitProjectArchiveHeader = "true"
          box.className = "ml-auto flex items-center gap-2"
          const currency = document.createElement("span")
          currency.className = "rounded-full border border-cyan-300/25 bg-cyan-300/[.08] px-3 py-2 text-xs font-semibold text-cyan-100"
          currency.textContent = "USD"
          fetch("/api/me", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((me) => { if (me?.currency) currency.textContent = me.currency }).catch(() => {})
          const trigger = document.createElement("button")
          trigger.type = "button"
          trigger.dataset.orbitProjectArchiveTrigger = "true"
          trigger.className = buttonClass
          trigger.addEventListener("click", () => setView("projects"))
          box.append(currency, trigger)
          const search = header.querySelector('input[placeholder="Search current view"]')?.closest("div")
          header.insertBefore(box, search || null)
        }
      }
      const projectTrigger = document.querySelector("[data-orbit-project-archive-trigger]") as HTMLButtonElement | null
      if (projectTrigger) projectTrigger.textContent = `Archived projects (${records.current.projects.filter((row) => row.archived).length}/50)`
    }
  }

  function scheduleScan(delay = 100) {
    if (scanTimer.current) window.clearTimeout(scanTimer.current)
    scanTimer.current = window.setTimeout(() => {
      scanTimer.current = null
      scan()
    }, delay)
  }

  useEffect(() => {
    refresh().catch(() => {})
    scheduleScan(0)

    const scanInterval = window.setInterval(() => scan(), 2200)
    const refreshInterval = window.setInterval(() => {
      const title = (document.querySelector("h1")?.textContent || "").trim()
      if (title === "Clients" || title === "Projects") refresh().catch(() => {})
    }, 15000)
    const onFocus = () => {
      refresh().catch(() => {})
      scheduleScan(60)
    }
    const onClick = () => {
      scheduleScan(100)
      window.setTimeout(() => scheduleScan(80), 420)
    }
    const onVisibility = () => document.visibilityState === "visible" && scheduleScan(50)

    window.addEventListener("focus", onFocus)
    document.addEventListener("click", onClick, true)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.clearInterval(scanInterval)
      window.clearInterval(refreshInterval)
      if (scanTimer.current) window.clearTimeout(scanTimer.current)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("click", onClick, true)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  useEffect(() => {
    scheduleScan(30)
  }, [clients, projects])

  const archived = view === "clients" ? clients.filter((row) => row.archived) : projects.filter((row) => row.archived)

  return view ? (
    <div className="fixed inset-0 z-[140] grid place-items-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-[28px] border border-cyan-300/20 bg-[#07111d] text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 p-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-cyan-200">Reserved archive</p>
            <h2 className="mt-1 text-xl font-semibold">Archived {view}</h2>
            <p className="mt-1 text-xs text-slate-500">{archived.length}/50 stored. Archived records are hidden from the active directory but remain safe.</p>
          </div>
          <button type="button" onClick={() => setView(null)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 hover:bg-white/10" aria-label="Close archive"><X size={18} /></button>
        </div>
        <div className="max-h-[68vh] space-y-2 overflow-y-auto p-5">
          {archived.length === 0 && <div className="rounded-2xl border border-white/10 bg-white/[.03] p-8 text-center text-sm text-slate-500">Nothing is archived yet.</div>}
          {archived.map((row) => (
            <div key={row.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <b className="block truncate text-sm">{row.name || "Untitled"}</b>
                <p className="truncate text-xs text-slate-500">{view === "clients" ? [row.company_name, row.email, row.service].filter(Boolean).join(" · ") : [row.client, row.kind, row.stage].filter(Boolean).join(" · ")}</p>
              </div>
              <button type="button" onClick={() => setArchived(view, row, false)} className={buttonClass}><RotateCcw size={14} className="mr-2" /> Restore</button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 border-t border-white/10 p-4 text-xs text-slate-500"><Archive size={14} /> Maximum archive capacity: 50 {view}.</div>
      </div>
    </div>
  ) : null
}
