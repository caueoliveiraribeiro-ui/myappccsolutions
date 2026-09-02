"use client"
import {useState} from "react"
import {Card} from "@/components/ui/card"
import {Input} from "@/components/ui/input"
import {Button} from "@/components/ui/button"
import {useCurrencyRates} from "@/components/currency-conversion"
type Row=Record<string,any>
export function BillingReminders({clients=[],tasks=[],editTask,currency="USD",ready=true}:Row){
 const convert=useCurrencyRates(clients,currency);
 const today=new Date().toISOString().slice(0,10);
 const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10);
 const recurring=clients.filter((c:Row)=>["monthly","biweekly","once a month"].includes(String(c.billing_frequency||"").toLowerCase())&&c.charge_date&&!["Lost","Past","Paused"].includes(c.status)).sort((a:Row,b:Row)=>String(a.charge_date).localeCompare(String(b.charge_date)));
 const money=(amount:number)=>Number.isFinite(amount)?new Intl.NumberFormat(undefined,{style:"currency",currency}).format(amount):"Conversion unavailable";
 return <Card className="min-w-0 border border-red-400/70 bg-gradient-to-br from-[#4a141e] via-[#241018] to-[#0b101a] p-5 font-bold text-white shadow-[0_0_25px_rgba(248,113,113,.16)]">
 <h2 className="text-lg font-bold text-red-100">Upcoming client payments</h2>
 <p className="mt-1 text-xs text-slate-400">Monthly and biweekly charges. A red Charge Client task is created one day before the due date (UTC). Overdue charges remain visible.</p>
 {!ready&&<p role="alert" className="mt-3 text-sm text-amber-200">Billing reminders are unavailable. Run the latest SQL migration and refresh.</p>}
 {recurring.length===0?<p className="mt-4 text-sm text-slate-400">Set a recurring billing frequency and charge date in Clients to see the next payments here.</p>:<div className="mt-4 max-h-80 space-y-3 overflow-y-auto">{recurring.map((c:Row)=>{
 const due=String(c.charge_date).slice(0,10),urgent=due<=tomorrow,task=tasks.find((t:Row)=>t.billing_client_id===c.id&&String(t.billing_due_date).slice(0,10)===due);
 return <details key={c.id} className={`rounded-xl border p-4 ${urgent?"border-red-400/60 bg-red-500/10":"border-white/10 bg-black/20"}`}>
 <summary className="flex cursor-pointer flex-wrap justify-between gap-3"><div><b>{c.name}</b><p className="text-xs text-slate-400">{c.billing_frequency} · {due} · {due<today?"Overdue":due===today?"Due today":due===tomorrow?"Due tomorrow":"Upcoming"}</p></div><b className={urgent?"text-red-200":"text-cyan-200"}>{money(convert(c.service_amount,c))}</b></summary>
 <div className="mt-3 space-y-2 text-sm"><p>{c.company_name} · {c.service}</p><p>{c.email} · {c.phone}</p><p className="text-slate-400">{c.description}</p><p>Invoice: {task?.invoice_number||"Pending — invoice will be generated later"}</p>
 {task?<InvoiceNumber task={task} editTask={editTask}/>:<p className="text-xs text-slate-400">Charge Client ({c.name}) will be created one day before this charge is due.</p>}</div>
 </details>})}</div>}
 </Card>
}
function InvoiceNumber({task,editTask}:Row){
 const [value,setValue]=useState(task.invoice_number||""),[busy,setBusy]=useState(false);
 return <form className="flex flex-wrap items-end gap-2" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await editTask(task.id,{invoice_number:value})}finally{setBusy(false)}}}>
 <label className="text-xs text-slate-400">Invoice number (optional)<Input value={value} onChange={e=>setValue(e.target.value)} placeholder="Pending"/></label>
 <Button type="submit" size="sm" disabled={busy}>Save invoice reference</Button>
 <span className="text-xs text-red-200">{task.title} · {task.status}</span>
 </form>
}
