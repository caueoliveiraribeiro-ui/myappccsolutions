"use client"

import { FormEvent, useMemo, useState } from "react"
import { FileDown, Mail, Plus, Printer, Send, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type Row = Record<string, any>
const money = (amount: unknown, currency: string) => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(amount || 0))
const escapeHtml = (value: unknown) => String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char))

export function InvoiceWorkspace({ invoices = [], clients = [], projects = [], currency = "USD", add, edit, del }: Row) {
  const [selectedClient, setSelectedClient] = useState("")
  const [sending, setSending] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const nextNumber = useMemo(() => `ORB-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(4, "0")}`, [invoices.length])

  async function createInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (creating) return
    setCreating(true)
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget))
      const created = await add({ ...values, amount: Number(values.amount || 0), currency, status: String(values.status || "draft") })
      if (!created) return
      event.currentTarget.reset()
      setSelectedClient("")
      toast.success("Invoice created.")
    } catch {
      toast.error("We could not create this invoice. Please try again.")
    } finally {
      setCreating(false)
    }
  }

  function printInvoice(invoice: Row) {
    const popup = window.open("", "_blank", "noopener,noreferrer,width=900,height=760")
    if (!popup) return toast.error("Allow pop-ups to export this invoice as a PDF.")
    popup.document.write(`<!doctype html><html><head><title>Invoice ${escapeHtml(invoice.invoice_number)}</title><style>body{font-family:Arial,sans-serif;color:#111827;padding:48px;max-width:760px;margin:auto}header{display:flex;justify-content:space-between;border-bottom:3px solid #22d3ee;padding-bottom:22px}h1{margin:0;font-size:32px}.meta{color:#475569;line-height:1.7}.total{margin-top:32px;background:#ecfeff;padding:20px;font-size:24px;font-weight:700;text-align:right}.notes{margin-top:30px;border-top:1px solid #cbd5e1;padding-top:18px;white-space:pre-wrap}@media print{body{padding:18px}}</style></head><body><header><div><h1>Orbit LM</h1><div class="meta">Life Management</div></div><div class="meta"><b>INVOICE</b><br>${escapeHtml(invoice.invoice_number)}<br>Issued ${escapeHtml(String(invoice.issue_date || "").slice(0, 10))}</div></header><section class="meta" style="margin-top:28px"><b>Bill to</b><br>${escapeHtml(invoice.client_name)}<br>${escapeHtml(invoice.client_email)}</section><section style="margin-top:32px"><b>${escapeHtml(invoice.service_name || "Service")}</b><div class="meta">Due ${escapeHtml(String(invoice.due_date || "On receipt").slice(0, 10))}</div></section><div class="total">Total: ${escapeHtml(money(invoice.amount, invoice.currency || currency))}</div>${invoice.notes ? `<div class="notes"><b>Notes</b><br>${escapeHtml(invoice.notes)}</div>` : ""}<script>window.onload=()=>window.print()<\/script></body></html>`)
    popup.document.close()
  }

  async function sendInvoice(invoice: Row) {
    if (!invoice.client_email) return toast.error("Add a client email before sending this invoice.")
    setSending(invoice.id)
    try {
      const message = `Hello ${invoice.client_name},\n\nYour Orbit LM invoice ${invoice.invoice_number} for ${money(invoice.amount, invoice.currency || currency)} is ready.\nService: ${invoice.service_name || "Service"}\nDue date: ${invoice.due_date || "On receipt"}\n\nThank you.`
      const response = await fetch("/api/email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: invoice.client_email, subject: `Invoice ${invoice.invoice_number}`, message }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "We could not send this invoice.")
      await edit(invoice.id, { status: "sent", sent_at: new Date().toISOString() })
      toast.success("Invoice sent by email.")
    } catch (error) { toast.error(error instanceof Error ? error.message : "We could not send this invoice.") } finally { setSending(null) }
  }

  return <div className="space-y-4"><Card className="border-cyan-300/20 bg-[#07111f] p-0 text-white"><details className="group"><summary className="flex cursor-pointer list-none items-center justify-between p-5"><div><h2 className="text-lg font-semibold">Create invoice</h2><p className="mt-1 text-sm text-slate-400">Use your saved client or project information, then export or email the finished invoice.</p></div><Plus className="text-cyan-200 transition group-open:rotate-45"/></summary><form className="grid gap-3 border-t border-white/10 p-5 md:grid-cols-2" onSubmit={createInvoice}><label className="text-xs text-slate-400">Saved client<select value={selectedClient} onChange={(event) => setSelectedClient(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#091522] px-3 text-sm"><option value="">Choose a client (optional)</option>{clients.map((client: Row) => <option key={client.id} value={client.id}>{client.name}{client.company_name ? ` · ${client.company_name}` : ""}</option>)}</select></label><label className="text-xs text-slate-400">Related project<select name="project_id" className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#091522] px-3 text-sm"><option value="">No linked project</option>{projects.map((project: Row) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>{(() => { const client = clients.find((item: Row) => item.id === selectedClient); return <><input type="hidden" name="client_id" value={selectedClient}/><label className="text-xs text-slate-400">Client name<Input name="client_name" required defaultValue={client?.name || ""}/></label><label className="text-xs text-slate-400">Client email<Input name="client_email" type="email" defaultValue={client?.email || ""}/></label><label className="text-xs text-slate-400">Invoice number<Input name="invoice_number" required defaultValue={nextNumber}/></label><label className="text-xs text-slate-400">Service<Input name="service_name" defaultValue={client?.service || ""}/></label></> })()}<label className="text-xs text-slate-400">Amount ({currency})<Input name="amount" required type="number" min="0" step="0.01"/></label><label className="text-xs text-slate-400">Issue date<Input name="issue_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)}/></label><label className="text-xs text-slate-400">Due date<Input name="due_date" type="date"/></label><label className="text-xs text-slate-400">Status<select name="status" className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#091522] px-3 text-sm"><option value="draft">Draft</option><option value="sent">Sent</option><option value="paid">Paid</option></select></label><label className="text-xs text-slate-400 md:col-span-2">Notes<Textarea name="notes" className="mt-1" placeholder="Payment instructions or a personal note."/></label><Button disabled={creating} className="md:col-span-2 bg-cyan-300 text-slate-950">{creating ? "Creating invoice…" : "Create invoice"}</Button></form></details></Card><Card className="border-white/10 bg-white/5 p-5 text-white"><h2 className="mb-4 font-semibold">Invoices</h2><div className="space-y-2">{invoices.length === 0 && <p className="text-sm text-slate-500">No invoices yet. Create one from a client or project above.</p>}{invoices.map((invoice: Row) => <details key={invoice.id} className="rounded-xl border border-white/[.08] bg-black/20"><summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-3"><div><b className="block text-sm">{invoice.invoice_number} · {invoice.client_name}</b><p className="text-xs text-slate-500">{invoice.service_name || "Service"} · due {String(invoice.due_date || "on receipt").slice(0, 10)}</p></div><b className="text-cyan-100">{money(invoice.amount, invoice.currency || currency)}</b></summary><div className="grid gap-3 border-t border-white/10 p-4 md:grid-cols-2"><label className="text-xs text-slate-400">Status<select value={invoice.status} onChange={(event) => edit(invoice.id, { status: event.target.value })} className="mt-1 h-9 w-full rounded-md border border-white/10 bg-[#111827] px-3"><option value="draft">Draft</option><option value="sent">Sent</option><option value="paid">Paid</option><option value="overdue">Overdue</option><option value="void">Void</option></select></label><p className="self-end text-xs text-slate-500">{invoice.client_email || "No email added"}</p><div className="flex flex-wrap gap-2 md:col-span-2"><Button size="sm" variant="outline" onClick={() => printInvoice(invoice)}><Printer size={14}/>Export PDF</Button><Button size="sm" onClick={() => sendInvoice(invoice)} disabled={sending === invoice.id} className="bg-cyan-300 text-slate-950"><Mail size={14}/>{sending === invoice.id ? "Sending…" : "Email invoice"}</Button><Button size="sm" variant="outline" className="border-red-400/30 text-red-200" onClick={() => confirm(`Delete ${invoice.invoice_number}?`) && del(invoice.id)}><Trash2 size={14}/>Delete</Button></div></div></details>)}</div></Card></div>
}

