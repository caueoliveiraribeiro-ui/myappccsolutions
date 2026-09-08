"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Archive, RotateCcw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

type Resource = "clients" | "projects"
type Row = Record<string, any>

export function ArchiveManagerButton({
  resource,
  label,
  className = "",
}: {
  resource: Resource
  label?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const singular = resource === "clients" ? "client" : "project"
  const title = resource === "clients" ? "Archived clients" : "Archived projects"

  async function refresh(showError = false) {
    setLoading(true)
    if (showError) setError("")
    try {
      const response = await fetch(`/api/archive/${resource}`, { cache: "no-store" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Archive unavailable.")
      setItems(data.items || [])
    } catch (err) {
      if (showError) setError(err instanceof Error ? err.message : "Archive unavailable.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh(false)
  }, [resource])

  async function restore(row: Row) {
    if (!confirm(`Restore ${row.name || `this ${singular}`} to the active ${resource} list?`)) return
    setLoading(true)
    setError("")
    try {
      const response = await fetch(`/api/archive/${resource}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: row.id, archived: false }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "We could not restore this record.")
      setItems((current) => current.filter((item) => item.id !== row.id))
      toast.success(`${singular === "client" ? "Client" : "Project"} restored.`)
      window.setTimeout(() => window.location.reload(), 120)
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not restore this record.")
      setLoading(false)
    }
  }

  const modal = open && typeof document !== "undefined"
    ? createPortal(
        <div className="fixed inset-0 z-[140] grid place-items-center bg-black/80 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
          <div className="max-h-[88dvh] w-full max-w-3xl overflow-hidden rounded-[26px] border border-cyan-300/20 bg-[#07111d] text-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-cyan-200">Reserved archive</p>
                <h2 className="mt-1 text-xl font-semibold">{title}</h2>
                <p className="mt-1 text-xs text-slate-500">{items.length}/50 stored. Deleted records can be restored for three months. Ordinary archives have no expiry.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 text-slate-300 hover:bg-white/10" aria-label="Close archive">
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[66dvh] space-y-2 overflow-y-auto p-4 sm:p-5">
              {loading && items.length === 0 && <p className="rounded-2xl border border-white/10 bg-white/[.03] p-6 text-center text-sm text-slate-400">Loading archive…</p>}
              {!loading && items.length === 0 && !error && <p className="rounded-2xl border border-white/10 bg-white/[.03] p-8 text-center text-sm text-slate-500">Nothing is archived yet.</p>}
              {error && <p role="alert" className="rounded-xl border border-red-300/25 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
              {items.map((row) => (
                <div key={row.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <b className="block truncate text-sm">{row.name || "Untitled"}</b>{row.delete_after && <p className="mt-1 text-xs text-amber-200">Recover before {new Date(row.delete_after).toLocaleDateString()}</p>}
                    <p className="truncate text-xs text-slate-500">
                      {resource === "clients"
                        ? [row.company_name, row.email, row.service].filter(Boolean).join(" · ")
                        : [row.client, row.kind, row.stage].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void restore(row)}>
                    <RotateCcw size={14} />
                    Restore
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 border-t border-white/10 p-4 text-xs text-slate-500">
              <Archive size={14} />
              Maximum archive capacity: 50 {resource}.
            </div>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={className}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen(true)
          void refresh(true)
        }}
      >
        <Archive size={14} />
        {label || `Archive ${resource}`} ({items.length}/50)
      </Button>
      {modal}
    </>
  )
}
