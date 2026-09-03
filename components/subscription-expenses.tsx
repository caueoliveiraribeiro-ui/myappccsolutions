"use client"
import {useState} from "react"
import {Input} from "@/components/ui/input"
import {Button} from "@/components/ui/button"
import {toast} from "sonner"
const providers=["Netflix","Disney+","Hulu","Max","Peacock","Paramount+","Apple TV+","Amazon Prime","Spotify","Apple Music","YouTube Premium","YouTube TV","Audible","Kindle Unlimited","Apple iCloud+","Google One","Dropbox","Microsoft 365","Adobe Creative Cloud","Canva","ChatGPT","QuickBooks","Zoom","Slack","Notion","GitHub","PlayStation Plus","Xbox Game Pass","Nintendo Switch Online","Walmart+","Costco","Sam’s Club","DoorDash DashPass","Uber One","Instacart+","Peloton","Planet Fitness","The New York Times","The Wall Street Journal"]
export function SubscriptionExpenses({currency,add}:{currency:string;add:(record:Record<string,unknown>)=>Promise<boolean>}){
 const [provider,setProvider]=useState("");const [busy,setBusy]=useState(false)
 async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;const form=event.currentTarget,data=new FormData(form),amount=Number(data.get("amount")),selected=provider==="Other"?String(data.get("custom_provider")||"").trim():provider;
 if(!selected||!Number.isFinite(amount)||amount<0){toast.error("Choose a subscription and enter a valid cost.");return}setBusy(true);try{if(await add({item_name:String(data.get("item_name")||"").trim()||selected,category:"Subscriptions",subcategory:selected,amount,currency,expense_date:data.get("expense_date"),kind:data.get("kind"),paid:true,notes:"Subscription charge"})){form.reset();setProvider("")}}catch{toast.error("We couldn’t save the subscription. Please try again.")}finally{setBusy(false)}}
 const today=new Date(),date=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`
 return <details className="rounded-2xl border border-cyan-300/25 bg-cyan-300/[.05] p-5 text-white"><summary className="cursor-pointer font-semibold">Subscription management <span className="text-cyan-300">⌄</span></summary><p className="my-3 text-sm text-slate-400">Record a subscription charge. Edit or delete it in the spending list. This does not create automatic recurring charges.</p><form onSubmit={submit} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
 <label className="text-xs text-slate-300">Subscription name<Input name="item_name" maxLength={160} placeholder="e.g. Family streaming plan"/></label>
 <label className="text-xs text-slate-300">Provider<select required value={provider} onChange={e=>setProvider(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-cyan-300/25 bg-[#102c46] px-3"><option value="">Choose a subscription</option>{providers.map(name=><option key={name}>{name}</option>)}<option>Other</option></select></label>
 {provider==="Other"&&<label className="text-xs text-slate-300">Other subscription<Input name="custom_provider" required maxLength={160} placeholder="Enter provider or service"/></label>}
 <label className="text-xs text-slate-300">Cost ({currency})<div className="relative"><span className="pointer-events-none absolute left-3 top-2 z-10 text-xs text-cyan-200">{currency}</span><Input name="amount" type="number" min="0" step="0.01" required placeholder="0.00" className="pl-14"/></div></label>
 <label className="text-xs text-slate-300">Billing date<Input name="expense_date" type="date" required defaultValue={date}/></label>
 <label className="text-xs text-slate-300">Type<select name="kind" className="mt-1 h-9 w-full rounded-md border border-cyan-300/25 bg-[#102c46] px-3"><option>Personal</option><option>Business</option></select></label>
 <div className="flex items-end"><Button disabled={busy} type="submit">{busy?"Saving…":"Add subscription charge"}</Button></div></form></details>
}
