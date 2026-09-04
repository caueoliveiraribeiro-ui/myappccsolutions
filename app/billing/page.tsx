"use client"
import {useState} from "react"
import {Button} from "@/components/ui/button"
export default function Billing(){
 const [message,setMessage]=useState(""),[busy,setBusy]=useState(false)
 async function manage(){
  setBusy(true);setMessage("")
  try{const r=await fetch("/api/billing/portal",{method:"POST"}),d=await r.json();if(!r.ok)throw Error(d.error);window.location.assign(d.url)}
  catch(e){setMessage(e instanceof Error?e.message:"Please try again.");setBusy(false)}
 }
 return <main className="grid min-h-screen place-items-center bg-[#050812] p-6 text-white"><section className="max-w-lg rounded-3xl border border-cyan-300/30 bg-[#102432] p-8"><h1 className="text-3xl font-semibold">Your Orbit billing</h1><p className="my-5 text-slate-300">Review invoices, update payment details or cancel your subscription securely in Stripe.</p><Button onClick={manage} disabled={busy}>{busy?"Opening…":"Manage subscription"}</Button>{message&&<p role="status" className="mt-4">{message}</p>}<a className="mt-6 block text-cyan-200 underline" href="/dashboard">Back to Orbit</a></section></main>
}
