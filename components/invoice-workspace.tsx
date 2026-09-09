"use client"

import { services } from "@/lib/service-options"

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react"
import { CalendarDays, CheckCircle2, CircleDollarSign, FileText, Mail, Plus, Printer, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type Row = Record<string, any>
const money = (amount: unknown, currency: string) => new Intl.NumberFormat(undefined, { style: "currency", currency: /^[A-Z]{3}$/.test(currency) ? currency : "USD" }).format(Number(amount || 0))
const formatDate = (value: unknown) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(String(value))) : "On receipt"
const statusClass: Record<string, string> = {
  draft: "border-slate-400/25 bg-slate-400/10 text-slate-200",
  awaiting_payment: "border-amber-300/25 bg-amber-300/10 text-amber-100",
  sent: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
  paid: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
  overdue: "border-amber-300/25 bg-amber-300/10 text-amber-100",
  void: "border-red-300/25 bg-red-300/10 text-red-100",
}

export function InvoiceWorkspace({ invoices = [], clients = [], projects = [], currency = "USD", onCreated, edit, del }: Row) {
  const [selectedClient, setSelectedClient] = useState("")
  const [sending, setSending] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [brand, setBrand] = useState({ company_name: "", logo_data_url: "", primary_color: "#07111F", accent_color: "#12BDE0" })
  const [savingBrand, setSavingBrand] = useState(false)
  const [recordingPayment, setRecordingPayment] = useState<string | null>(null)
  const [visibleInvoiceCount, setVisibleInvoiceCount] = useState(40)
  useEffect(() => { fetch("/api/invoice-branding").then(r => r.ok ? r.json() : {}).then((d: any) => d.branding && setBrand({ company_name: d.branding.company_name || "", logo_data_url: d.branding.logo_data_url || "", primary_color: d.branding.primary_color || "#07111F", accent_color: d.branding.accent_color || "#12BDE0" })).catch(() => {}) }, [])
  const nextNumber = useMemo(() => `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(4, "0")}`, [invoices.length])
  const client = clients.find((item: Row) => item.id === selectedClient)

  async function createInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    if (creating) return
    setCreating(true)
    try {
      const values = Object.fromEntries(new FormData(form))
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, amount: Number(values.amount || 0), currency: client?.currency || currency, status: String(values.status || "draft") }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.invoice?.id) throw new Error(data.error || "We could not create this invoice.")
      await onCreated?.(data.invoice)
      form.reset()
      setSelectedClient("")
      toast.success(`Invoice ${data.invoice.invoice_number} is ready.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not create this invoice. Please try again.")
    } finally {
      setCreating(false)
    }
  }

  async function saveBrand() {
    setSavingBrand(true)
    try {
      const response = await fetch("/api/invoice-branding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(brand) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "We could not save your invoice brand.")
      setBrand({ company_name: data.branding.company_name || "", logo_data_url: data.branding.logo_data_url || "", primary_color: data.branding.primary_color || "#07111F", accent_color: data.branding.accent_color || "#12BDE0" })
      toast.success("Invoice brand saved.")
    } catch (error) { toast.error(error instanceof Error ? error.message : "We could not save your invoice brand.") } finally { setSavingBrand(false) }
  }
  function pickLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2_500_000) { toast.error("Choose a JPG, PNG, or WebP logo smaller than 2.5 MB."); event.target.value = ""; return }
    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const largestSide = Math.max(image.width, image.height)
        const scale = largestSide > 1200 ? 1200 / largestSide : 1
        const canvas = document.createElement("canvas")
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))
        const context = canvas.getContext("2d")
        if (!context) { toast.error("We could not prepare this logo. Please choose another image."); return }
        context.fillStyle = "#ffffff"
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        let optimized = canvas.toDataURL("image/jpeg", 0.86)
        if (optimized.length > 1_150_000) optimized = canvas.toDataURL("image/jpeg", 0.68)
        if (optimized.length > 1_250_000) { toast.error("This logo is still too detailed after optimization. Try a simpler image."); return }
        setBrand(current => ({ ...current, logo_data_url: optimized }))
      }
      image.onerror = () => toast.error("We could not read that image. Please choose a JPG, PNG, or WebP logo.")
      image.src = String(reader.result || "")
    }
    reader.readAsDataURL(file)
  }

  async function sendInvoice(invoice: Row) {
    setSending(invoice.id)
    try {
      const response = await fetch(`/api/invoices/${encodeURIComponent(invoice.id)}/email`, { method: "POST" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "We could not send this invoice.")
      if (data.invoice) await edit(invoice.id, data.invoice)
      window.dispatchEvent(new CustomEvent("orbit:records-changed", { detail: { resource: "clients" } }))
      toast.success("Invoice sent — awaiting payment. The client’s next charge date has been updated where applicable.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not send this invoice.")
    } finally {
      setSending(null)
    }
  }

  async function recordPayment(invoice: Row) {
    if (recordingPayment || invoice.status === "paid") return
    if (!confirm(`Record ${money(invoice.amount, invoice.currency || currency)} as paid for ${invoice.invoice_number}?`)) return
    setRecordingPayment(invoice.id)
    try {
      const date = new Date().toISOString().slice(0, 10)
      const paymentResponse = await fetch("/api/data/payment_records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
        source_project_id: invoice.project_id || null,
        billing_client_id: invoice.client_id || null,
        client_name: invoice.client_name || "Invoice client",
        project_name: invoice.service_name || invoice.invoice_number || "Invoice payment",
        amount: Number(invoice.amount || 0),
        currency: invoice.currency || currency,
        status: "Payment received",
        received_at: date,
        method: "Invoice",
        reference: invoice.invoice_number || "",
        notes: `Recorded from invoice ${invoice.invoice_number || ""}`.trim(),
        }),
      })
      const paymentData = await paymentResponse.json().catch(() => ({}))
      if (!paymentResponse.ok) throw new Error(paymentData.error || "The payment record could not be saved.")
      const saved = await edit(invoice.id, { status: "paid" })
      if (saved === false) throw new Error("The invoice status could not be updated.")
      window.dispatchEvent(new CustomEvent("orbit:records-changed", { detail: { resource: "payment_records" } }))
      toast.success("Payment recorded. This invoice and your payment ledger are now up to date.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not record this payment.")
    } finally {
      setRecordingPayment(null)
    }
  }

  return <div className="space-y-5">
    <Card className="invoice-brand-colors border-cyan-300/20 p-5 sm:p-6">
      <h2 className="font-semibold">Your invoice colors</h2>
      <p className="mt-1 text-sm text-slate-400">Choose the header and accent colors for new invoices, including automatic drafts. Existing invoices keep their saved colors.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-cyan-300/25 p-3">Header color<input aria-label="Invoice header color" type="color" value={brand.primary_color} onChange={e => setBrand(current => ({ ...current, primary_color: e.target.value }))} className="h-11 w-16 cursor-pointer"/></label>
        <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-cyan-300/25 p-3">Accent color<input aria-label="Invoice accent color" type="color" value={brand.accent_color} onChange={e => setBrand(current => ({ ...current, accent_color: e.target.value }))} className="h-11 w-16 cursor-pointer"/></label>
      </div>
      <div aria-label="Invoice color preview" className="mt-4 h-16 rounded-xl border-b-4" style={{ backgroundColor: brand.primary_color, borderBottomColor: brand.accent_color }}/>
      <Button className="mt-4" type="button" disabled={savingBrand} onClick={saveBrand}>{savingBrand ? "Saving…" : "Save invoice colors"}</Button>
    </Card>
    <Card className="invoice-create-card overflow-hidden border-cyan-300/25 bg-[linear-gradient(135deg,rgba(7,17,31,.98),rgba(14,32,52,.96))] p-0 text-white shadow-[0_18px_65px_rgba(0,0,0,.22)]">
      <details className="group" open>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 sm:p-6">
          <div className="flex items-center gap-4"><span className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-200"><FileText size={21}/></span><div><h2 className="font-semibold">Create a polished invoice</h2><p className="mt-1 text-sm text-slate-400">Create, download, or email a branded PDF from one secure workspace.</p></div></div>
          <Plus className="shrink-0 text-cyan-200 transition group-open:rotate-45"/>
        </summary>
        <form className="grid gap-4 border-t border-cyan-300/15 bg-black/10 p-5 sm:p-6 md:grid-cols-2" onSubmit={createInvoice}>
          <label className="text-xs font-medium text-slate-300">Saved client
            <select value={selectedClient} onChange={(event) => setSelectedClient(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-[#07111f] px-3 text-sm text-white">
              <option value="">Create for a new client</option>{clients.map((item: Row) => <option key={item.id} value={item.id}>{item.name}{item.company_name ? ` · ${item.company_name}` : ""}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-300">Related project
            <select name="project_id" className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-[#07111f] px-3 text-sm text-white"><option value="">No linked project</option>{projects.map((project: Row) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
          </label>
          <input type="hidden" name="client_id" value={selectedClient}/>
          <label className="text-xs font-medium text-slate-300">Client name<Input key={`name-${selectedClient}`} name="client_name" required defaultValue={client?.name || ""} className="mt-1.5 h-11"/></label>
          <label className="text-xs font-medium text-slate-300">Client email<Input key={`email-${selectedClient}`} name="client_email" type="email" defaultValue={client?.email || ""} className="mt-1.5 h-11"/></label><label className="text-xs font-medium text-slate-300">Billing address<Textarea key={`address-${selectedClient}`} name="client_address" defaultValue={client?.address || ""} className="mt-1.5 min-h-11 h-11" placeholder="Street, suite, city, region, postal code, country"/></label>
          <label className="text-xs font-medium text-slate-300">Invoice number<Input name="invoice_number" required defaultValue={nextNumber} className="mt-1.5 h-11"/></label>
          <label className="text-xs font-medium text-slate-300">Service / deliverable<select key={`service-${selectedClient}`} name="service_name" defaultValue={client?.service || ""} className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-[#07111f] px-3"><option value="">Choose service</option>{client?.service && !services.includes(client.service) && <option>{client.service}</option>}{services.map(service=><option key={service}>{service}</option>)}</select></label>
          <label className="text-xs font-medium text-slate-300 md:col-span-2">Description<Textarea key={`description-${selectedClient}`} name="description" maxLength={500} defaultValue={client?.description || ""} placeholder="Describe the work included in this invoice" className="mt-1.5 min-h-20"/></label>
          <label className="text-xs font-medium text-slate-300">Total due ({client?.currency || currency})<Input key={selectedClient} name="amount" required type="number" min="0" step="0.01" defaultValue={client?.service_amount ?? ""} placeholder="0.00" className="mt-1.5 h-11"/></label>
          <label className="text-xs font-medium text-slate-300">Issue date<Input name="issue_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="mt-1.5 h-11"/></label>
          <label className="text-xs font-medium text-slate-300">Payment due date<Input name="due_date" type="date" className="mt-1.5 h-11"/></label>
          <label className="text-xs font-medium text-slate-300">Invoice status
            <select name="status" defaultValue="draft" className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-[#07111f] px-3 text-sm text-white"><option value="draft">Draft</option><option value="awaiting_payment">Awaiting payment</option><option value="paid">Paid</option></select>
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-300/15 bg-cyan-300/[.05] p-4 text-sm text-slate-300 md:col-span-2"><span className="flex items-center gap-2"><CheckCircle2 size={17} className="text-cyan-200"/>A branded PDF is generated only after the invoice is saved.</span><Button disabled={creating} className="min-w-44 bg-cyan-300 text-slate-950 hover:bg-cyan-200">{creating ? "Saving invoice…" : "Create invoice"}</Button></div>
        </form>
      </details>
    </Card>

    <Card className="border-cyan-300/20 bg-white/[.035] p-5 text-white sm:p-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="font-semibold">Your invoice brand</h2><p className="mt-1 text-sm text-slate-400">This logo is used on every invoice you create and every scheduled draft.</p></div>{brand.logo_data_url ? <img src={brand.logo_data_url} alt="Invoice logo preview" className="h-12 max-w-32 rounded-xl border border-cyan-300/25 bg-white object-contain p-1"/> : <span className="grid h-12 w-12 place-items-center rounded-xl border border-dashed border-cyan-300/25 text-cyan-200"><FileText size={19}/></span>}</div><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]"><label className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/20">Choose logo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={pickLogo} className="sr-only"/></label><p className="text-xs text-slate-500 sm:col-span-2">JPG, PNG, or WebP up to 2.5 MB. It is optimized securely before saving.</p><Button type="button" disabled={savingBrand} onClick={saveBrand} className="bg-cyan-300 text-slate-950">{savingBrand?"Saving…":"Save brand"}</Button></div></Card>

    <Card className="border-white/10 bg-white/[.035] p-5 text-white sm:p-6"><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-semibold">Invoice workspace</h2><p className="mt-1 text-sm text-slate-400">Every saved invoice stays editable, downloadable, and ready to send.</p></div><span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">{invoices.length} saved</span></div>
      <div className="invoice-scroll-region max-h-[72vh] space-y-3 overflow-y-auto overscroll-contain pr-2">{invoices.length === 0 && <div className="rounded-2xl border border-dashed border-cyan-300/20 bg-cyan-300/[.035] p-8 text-center text-sm text-slate-400">Your first branded invoice will appear here after you create it.</div>}
      {invoices.slice(0, visibleInvoiceCount).map((invoice: Row) => <details key={invoice.id} className="overflow-hidden rounded-2xl border border-white/[.09] bg-[#06101d]/80" style={{ contentVisibility: "auto", containIntrinsicSize: "180px" }}><summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4 p-4"><div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200"><FileText size={18}/></span><div className="min-w-0"><b className="block truncate text-sm">{invoice.invoice_number} · {invoice.client_name}</b><p className="mt-1 truncate text-xs text-slate-500">{invoice.service_name || "Professional services"} · due {formatDate(invoice.due_date)}</p></div></div><div className="flex items-center gap-3"><b className="text-cyan-100">{money(invoice.amount, invoice.currency || currency)}</b><span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusClass[invoice.status] || statusClass.draft}`}>{["sent", "awaiting_payment"].includes(invoice.status) ? "Awaiting payment" : invoice.status || "draft"}</span></div></summary>
        <div className="grid gap-4 border-t border-white/10 p-4 md:grid-cols-2"><label className="text-xs text-slate-400">Status<select value={invoice.status === "sent" ? "awaiting_payment" : invoice.status || "draft"} onChange={(event) => edit(invoice.id, { status: event.target.value })} className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-[#091522] px-3 text-sm text-white"><option value="draft">Draft</option><option value="awaiting_payment">Awaiting payment</option><option value="paid">Paid</option><option value="overdue">Overdue</option><option value="void">Void</option></select></label><label className="text-xs text-slate-400">Client name<Input defaultValue={invoice.client_name || ""} className="mt-1.5 h-10" onBlur={(event) => edit(invoice.id, { client_name: event.target.value })}/></label><label className="text-xs text-slate-400">Billing address<Textarea defaultValue={invoice.client_address || ""} className="mt-1.5 min-h-11 h-11" placeholder="No billing address yet" onBlur={(event) => edit(invoice.id, { client_address: event.target.value })}/></label><label className="text-xs text-slate-400">Service<select value={invoice.service_name || ""} onChange={event=>edit(invoice.id,{service_name:event.target.value})} className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-[#091522] px-3"><option value="">Choose service</option>{invoice.service_name && !services.includes(invoice.service_name) && <option>{invoice.service_name}</option>}{services.map(service=><option key={service}>{service}</option>)}</select></label><label className="text-xs text-slate-400 md:col-span-2">Description<Textarea defaultValue={invoice.description || ""} maxLength={500} className="mt-1.5" onBlur={event=>edit(invoice.id,{description:event.target.value})}/></label><label className="text-xs text-slate-400">Total due<Input defaultValue={Number(invoice.amount || 0)} type="number" min="0" step="0.01" className="mt-1.5 h-10" onBlur={(event) => edit(invoice.id, { amount: Number(event.target.value || 0)})}/></label><div className="rounded-xl border border-white/[.08] bg-black/20 p-3 text-xs text-slate-400"><CalendarDays size={14} className="mb-1 text-cyan-200"/>Issued {formatDate(invoice.issue_date)}<br/>{invoice.client_email || "No recipient email yet"}</div><div className="flex flex-wrap gap-2 md:col-span-2"><Button size="sm" variant="outline" asChild><a href={`/api/invoices/${encodeURIComponent(invoice.id)}/pdf`} target="_blank" rel="noreferrer"><Printer size={14}/>Download PDF</a></Button><Button size="sm" onClick={() => sendInvoice(invoice)} disabled={sending === invoice.id} className="bg-cyan-300 text-slate-950"><Mail size={14}/>{sending === invoice.id ? "Sending…" : "Email PDF"}</Button><Button size="sm" type="button" variant="outline" disabled={recordingPayment === invoice.id || invoice.status === "paid"} className="border-emerald-300/30 text-emerald-100" onClick={() => void recordPayment(invoice)}><CircleDollarSign size={14}/>{recordingPayment === invoice.id ? "Recording…" : invoice.status === "paid" ? "Payment recorded" : "Record payment"}</Button><Button size="sm" variant="outline" className="border-red-400/30 text-red-200" onClick={() => confirm(`Delete ${invoice.invoice_number}?`) && del(invoice.id)}><Trash2 size={14}/>Delete</Button></div></div>
      </details>)}
      {visibleInvoiceCount < invoices.length && <Button type="button" variant="outline" className="w-full" onClick={() => setVisibleInvoiceCount(count => count + 40)}>Show more invoices</Button>}</div>
    </Card>
  </div>
}
