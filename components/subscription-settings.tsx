"use client"
import {useState} from "react"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Card} from "@/components/ui/card"
import {limitsFor, type Plan} from "@/lib/plan-features"
import {PRICING_LINK} from "@/components/plan-lock"
const names:Record<string,string>={none:"No active plan",personal:"Personal",small_business:"Small Business",big_business:"Big Business",owner:"Owner"}
export function SubscriptionSettings({me}:{me:Record<string,any>}){
 const [email,setEmail]=useState(""),[account,setAccount]=useState<any>(null),[plan,setPlan]=useState("personal"),[status,setStatus]=useState("active"),[until,setUntil]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("")
 const access=me.access||{},limits=limitsFor((access.plan||"none") as Plan)
 async function lookup(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage("");setAccount(null);try{
  const r=await fetch("/api/admin/plans?email="+encodeURIComponent(email)),d=await r.json();if(!r.ok)throw Error(d.error)
  setAccount({...d.user,access:d.access});setPlan(["personal","small_business","big_business"].includes(d.access?.plan)?d.access.plan:"personal");setStatus("active");setUntil(d.access?.accessUntil?new Date(d.access.accessUntil).toISOString().slice(0,16):"")
 }catch(e){setMessage(e instanceof Error?e.message:"Could not look up this account.")}finally{setBusy(false)}}
 async function save(e:React.FormEvent){e.preventDefault();if(!account||!window.confirm("Apply this access assignment to "+account.email+"? Existing records will be preserved."))return;setBusy(true);setMessage("");try{
  const r=await fetch("/api/admin/plans",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:account.email,plan,status,accessUntil:until?new Date(until+"Z").toISOString():null})}),d=await r.json();if(!r.ok)throw Error(d.error)
  setAccount({...account,access:d.access});setMessage("Access assignment saved. The member’s app will refresh its permissions within a minute.")
 }catch(e){setMessage(e instanceof Error?e.message:"Could not save access.")}finally{setBusy(false)}}
 return <Card className="border-cyan-300/25 bg-gradient-to-br from-cyan-300/[.08] to-violet-400/[.06] p-5 text-white lg:col-span-2">
  <h2 className="text-lg font-semibold">Your Orbit plan</h2><p className="mt-2 text-cyan-200">{names[access.plan]||"Checking access…"} · {access.status||"Checking"}</p>
  {access.accessUntil&&<p className="mt-1 text-sm text-slate-400">Access valid until {new Date(access.accessUntil).toLocaleString()}</p>}
  <div className="my-4 grid gap-3 sm:grid-cols-3">{([["activeLeads","Active leads"],["archivedLeads","Archived leads"],["clients","Clients"]] as const).map(([key,label])=><div key={key} className="rounded-xl border border-cyan-300/15 bg-black/20 p-3"><p className="text-sm text-slate-400">{label}</p><b>{me.usage?.[key]??"—"} / {limits[key]===null?"Unlimited":limits[key]}</b></div>)}</div>
  <p className="text-xs text-slate-400">Limits apply to records owned by your workspace. Existing records are kept when plans change. Paid access currently requires an administrator assignment.</p>
  <Button asChild className="mt-4 bg-cyan-300 text-slate-950"><a href={PRICING_LINK}>Explore plans</a></Button>
  {access.plan==="owner"&&<details className="mt-6 rounded-xl border border-violet-300/25 p-4"><summary className="cursor-pointer font-semibold text-violet-200">Owner controls · Assign account access</summary>
   <p className="my-3 text-sm text-slate-400">Find a verified account, choose its plan and set an access end date. This does not charge the customer or connect Paddle.</p>
   <form onSubmit={lookup} className="flex flex-wrap gap-2"><Input aria-label="Member email" type="email" required value={email} onChange={e=>{setEmail(e.target.value);setAccount(null)}} placeholder="Member email" className="min-w-0 flex-1"/><Button disabled={busy}>Find account</Button></form>
   {account&&<form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2"><p className="sm:col-span-2">{account.name} · {account.email} · {names[account.access?.plan]||"No active plan"}</p>
    <label className="text-sm">Plan<select className="mt-1 w-full" value={plan} onChange={e=>setPlan(e.target.value)}><option value="personal">Personal</option><option value="small_business">Small Business</option><option value="big_business">Big Business</option></select></label>
    <label className="text-sm">Status<select className="mt-1 w-full" value={status} onChange={e=>setStatus(e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="past_due">Past due</option><option value="canceled">Canceled</option></select></label>
    <label className="text-sm">Access ends (UTC)<Input type="datetime-local" required={status==="active"} value={until} onChange={e=>setUntil(e.target.value)}/></label>
    <Button disabled={busy||account.access?.plan==="owner"} className="self-end">Save access assignment</Button>
   </form>}
   {message&&<p role="status" className="mt-3 text-sm text-cyan-100">{message}</p>}
  </details>}
 </Card>
}
