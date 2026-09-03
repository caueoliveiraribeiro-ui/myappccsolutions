"use client"
import {paymentStatuses} from "@/components/payment-status"
import {useState} from "react"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Textarea} from "@/components/ui/textarea"
import {toast} from "sonner"
type Row=Record<string,any>
const currencies=["USD","BRL","EUR","GBP","CAD","AUD","JPY","KRW","MXN","CHF"]
const inputClass="mt-1 h-9 w-full rounded-md border border-white/10 bg-[#111827] px-3"
type LedgerFilters={status:string;month:string;client:string;name:string;order:string}
const defaultFilters:LedgerFilters={status:"",month:"",client:"",name:"",order:"newest"}
export function filterLedgerPayments(payments:Row[],projects:Row[],filters:LedgerFilters){
  const normalize=(value:unknown)=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim()
  const date=(row:Row)=>String(row.received_at||"").slice(0,10)
  return payments.filter(row=>{
    const project=projects.find(p=>p.id===row.source_project_id)
    return (!filters.status||(row.status||"Payment received")===filters.status)
      &&(!filters.month||date(row).slice(0,7)===filters.month)
      &&normalize(row.client_name||project?.client).includes(normalize(filters.client))
      &&normalize(row.project_name||project?.name).includes(normalize(filters.name))
  }).sort((a,b)=>{
    const left=date(a),right=date(b)
    if(!left||!right)return left?-1:right?1:0
    return filters.order==="oldest"?left.localeCompare(right):right.localeCompare(left)
  })
}
export function paymentPayload(form:FormData,payment?:Row){
  const data=Object.fromEntries(form),amount=Number(data.amount),currency=String(data.currency||"").trim().toUpperCase()
  if(!String(data.amount||"").trim()||!Number.isFinite(amount)||amount<=0)throw Error("Please enter an amount greater than zero.")
  if(!currencies.includes(currency))throw Error("Please choose the original payment currency.")
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(data.received_at||"")))throw Error("Please choose the received or expected payment date.")
  if(!paymentStatuses.includes(String(data.status||"Payment received") as any))throw Error("Please choose a valid payment status.")
  return {...data,status:String(data.status||"Payment received"),project_name:String(data.project_name??payment?.project_name??"Payment").trim()||"Payment",amount,currency}
}
function PaymentForm({payment,currency,onSave,onCancel}:{payment?:Row;currency:string;onSave:(data:Row)=>Promise<any>;onCancel:()=>void}){
  const [busy,setBusy]=useState(false),[error,setError]=useState("")
  const today=new Date(),date=String(payment?.received_at||`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`).slice(0,10)
  return <form className="grid gap-3 border-t border-white/10 p-4 sm:grid-cols-2" onSubmit={async event=>{
    event.preventDefault();if(busy)return;setError("")
    try{const data=paymentPayload(new FormData(event.currentTarget),payment);setBusy(true);const saved=await onSave(data);if(saved===false){setError("Could not save this payment. Please try again.");return}toast.success(payment?"Payment updated":"Payment added");onCancel()}catch(error){setError(error instanceof Error?error.message:"Could not save this payment.")}finally{setBusy(false)}
  }}>
    <label className="text-xs text-slate-400">Payment status<select name="status" defaultValue={payment?.status||"Payment received"} className={inputClass}>{paymentStatuses.map(status=><option key={status} value={status}>{status}</option>)}</select></label>
    <label className="text-xs text-slate-400">Client (optional)<Input name="client_name" defaultValue={payment?.client_name||""}/></label>
    <label className="text-xs text-slate-400">Payment amount<Input name="amount" type="number" min="0.00000001" step="any" required defaultValue={payment?.amount??""}/></label>
    <label className="text-xs text-slate-400">Original currency<select name="currency" required defaultValue={payment?payment.currency||"":currency} className={inputClass}><option value="" disabled>Select currency</option>{currencies.map(code=><option key={code} value={code}>{code}</option>)}</select></label>
    <label className="text-xs text-slate-400">Payment date (received / expected)<Input name="received_at" type="date" required defaultValue={date}/></label>
    <label className="text-xs text-slate-400">Method<select name="method" defaultValue={payment?.method||"Other"} className={inputClass}>{["Bank transfer","Card","Cash","PayPal","Stripe","Other"].map(method=><option key={method} value={method}>{method}</option>)}</select></label>
    <label className="text-xs text-slate-400 sm:col-span-2">Reference / invoice (optional)<Input name="reference" defaultValue={payment?.reference||""}/></label>
    <label className="text-xs text-slate-400 sm:col-span-2">Notes (optional)<Textarea name="notes" defaultValue={payment?.notes||""}/></label>
    {error&&<p role="alert" className="text-sm text-red-300 sm:col-span-2">{error}</p>}
    <div className="flex gap-2 sm:col-span-2"><Button disabled={busy} type="submit">{busy?"Saving…":"Save payment"}</Button><Button disabled={busy} type="button" variant="outline" onClick={onCancel}>Cancel</Button></div>
  </form>
}
export function PaymentLedger({payments,projects,currency,convert,money,addPayment,editPayment,delPayment}:{
  payments:Row[];projects:Row[];currency:string;convert:(amount:any,row:Row)=>number;money:(n:number)=>string;
  addPayment:(data:Row)=>Promise<any>;editPayment:(id:string,data:Row)=>Promise<any>;delPayment:(id:string)=>Promise<any>
}){
  const [adding,setAdding]=useState(false),[editing,setEditing]=useState<string|null>(null),[deleting,setDeleting]=useState<string|null>(null)
  const [filters,setFilters]=useState<LedgerFilters>(defaultFilters)
  const visible=filterLedgerPayments(payments,projects,filters)
  function filter(field:keyof LedgerFilters,value:string){setFilters(previous=>({...previous,[field]:value}));setEditing(null)}
  async function remove(payment:Row){
    if(!confirm(payment.source_project_id?"Delete this payment? Its linked project will return to Awaiting payment.":"Delete this payment? It will be removed from your received-payment totals."))return
    setDeleting(payment.id)
    try{if(await delPayment(payment.id)===false)toast.error("Could not delete this payment. Please try again.")}catch{toast.error("Could not delete this payment. Please try again.")}finally{setDeleting(null)}
  }
  return <section className="rounded-xl border border-white/10 bg-white/5 p-5 text-white">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Payment ledger · {currency}</h2><Button type="button" onClick={()=>{setAdding(true);setEditing(null)}} disabled={adding}>+ Add payment</Button></div>
    <p className="mb-4 text-xs text-slate-400">Track awaiting, received or cancelled payments without creating a project. Edit or delete entries here; dashboard and history totals update automatically. Project-linked payments retain their connection.</p>
    {adding&&<div className="mb-4 rounded-xl border border-blue-300/30 bg-blue-400/5"><h3 className="p-4 font-semibold">Add payment</h3><PaymentForm currency={currency} onSave={addPayment} onCancel={()=>setAdding(false)}/></div>}
    <div className="mb-4 grid gap-3 rounded-xl border border-blue-300/20 bg-black/15 p-3 sm:grid-cols-2 xl:grid-cols-5">
      <label className="text-xs text-slate-400">Filter by status<select value={filters.status} onChange={e=>filter("status",e.target.value)} className={inputClass}><option value="">All statuses</option>{paymentStatuses.map(status=><option key={status} value={status}>{status}</option>)}</select></label>
      <label className="text-xs text-slate-400">Payment month<Input type="month" value={filters.month} onChange={e=>filter("month",e.target.value)} className="mt-1"/></label>
      <label className="text-xs text-slate-400">Client name<Input value={filters.client} onChange={e=>filter("client",e.target.value)} placeholder="Search client name" className="mt-1"/></label>
      <label className="text-xs text-slate-400">Payment name<Input value={filters.name} onChange={e=>filter("name",e.target.value)} placeholder="Search payment name" className="mt-1"/></label>
      <label className="text-xs text-slate-400">Payment date order<select value={filters.order} onChange={e=>filter("order",e.target.value)} className={inputClass}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
      <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2 xl:col-span-5"><p aria-live="polite" className="text-xs text-slate-400">{visible.length} / {payments.length} payments</p><Button type="button" variant="outline" onClick={()=>{setFilters({...defaultFilters});setEditing(null)}}>Clear filters</Button></div>
      <p className="text-xs text-slate-500 sm:col-span-2 xl:col-span-5">Filters affect this list only. Month uses the received or expected payment date.</p>
    </div>
    <div className="space-y-2">{!payments.length&&<p className="text-sm text-slate-400">No payments recorded yet.</p>}
      {payments.length>0&&!visible.length&&<p className="text-sm text-slate-400">No payments match these filters.</p>}
      {visible.map(payment=>{const project=projects.find(p=>p.id===payment.source_project_id);return <article key={payment.id} className="rounded-2xl border border-emerald-300/15 bg-emerald-400/[.035]">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div><b className="text-sm">{payment.project_name||project?.name||"Payment"}</b><p className="text-xs text-slate-400">{payment.client_name||project?.client||"No client"} · {String(payment.received_at||"").slice(0,10)} · {payment.method||"Other"}</p></div>
          <div><span className={"mb-1 block w-fit rounded-full border px-3 py-1 text-xs "+(payment.status==="Awaiting payment"?"border-amber-300/30 bg-amber-400/10 text-amber-200":payment.status==="Cancelled"?"border-red-300/30 bg-red-400/10 text-red-200":"border-emerald-300/30 bg-emerald-400/10 text-emerald-200")}>{payment.status||"Payment received"}</span><b className="text-emerald-300">{money(convert(payment.amount,payment))}</b><p className="text-xs text-slate-400">{payment.currency?`Original: ${payment.currency} ${Number(payment.amount||0).toLocaleString()}`:"Original currency needed"}</p></div>
          <div className="flex gap-2"><Button type="button" variant="outline" aria-expanded={editing===payment.id} onClick={()=>{setEditing(editing===payment.id?null:payment.id);setAdding(false)}}>Edit payment</Button><Button type="button" variant="outline" className="border-red-400/30 text-red-200" disabled={deleting!==null} onClick={()=>remove(payment)}>{deleting===payment.id?"Deleting…":"Delete payment"}</Button></div>
        </div>
        {editing===payment.id&&<PaymentForm payment={payment} currency={currency} onSave={data=>editPayment(payment.id,data)} onCancel={()=>setEditing(null)}/>}
      </article>})}
    </div>
  </section>
}

