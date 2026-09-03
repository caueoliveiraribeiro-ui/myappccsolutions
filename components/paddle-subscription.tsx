"use client"
import {useEffect,useState} from "react"
import Script from "next/script"
import {Button} from "@/components/ui/button"
import {Card} from "@/components/ui/card"
import type {StandardPlan} from "@/lib/paddle-plans"
type PaddleBrowser={Initialize:(v:unknown)=>void;Checkout:{open:(v:unknown)=>void}}
const sdk=()=> (window as unknown as {Paddle?:PaddleBrowser}).Paddle
export function PaddleSubscription({plan,name,monthlyUsd,email,ready,owner,token}:{plan:StandardPlan;name:string;monthlyUsd:number;email:string;ready:boolean;owner:boolean;token:string}){
 const [loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[waiting,setWaiting]=useState(false),[message,setMessage]=useState(""),[active,setActive]=useState(false)
 useEffect(()=>{
  if(!loaded||!ready)return
  sdk()?.Initialize({token,eventCallback:(e:{name:string})=>{
    if(e.name==="checkout.completed"){setWaiting(true);setMessage("Payment submitted. Waiting for secure confirmation—please do not pay again.")}
  }})
 },[loaded,ready,token])
 useEffect(()=>{
  if(!waiting)return
  let disposed=false
  const check=async()=>{try{
   const r=await fetch("/api/billing/status",{cache:"no-store"}),d=await r.json()
   if(!disposed&&r.ok&&d.access?.status==="active"&&d.access?.plan===plan){setActive(true);setWaiting(false);setMessage("Your plan is active. Welcome to your Orbit.")}
  }catch{}}
  void check();const timer=setInterval(check,5000)
  const timeout=setTimeout(()=>{if(!disposed){setWaiting(false);setMessage("Confirmation is taking longer than expected. Do not pay again. You can refresh this page or check Settings shortly.")}},120000)
  return()=>{disposed=true;clearInterval(timer);clearTimeout(timeout)}
 },[waiting,plan])
 async function openCheckout(){
  setBusy(true);setMessage("")
  try{
   const r=await fetch("/api/billing/checkout",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({plan})}),d=await r.json()
   if(!r.ok)throw Error(d.error)
   if(!sdk())throw Error("Checkout did not load. Refresh this page and try again.")
   sdk()!.Checkout.open({transactionId:d.transactionId,customer:{email},settings:{theme:"dark",allowLogout:false}})
  }catch(e){setMessage(e instanceof Error?e.message:"Checkout is unavailable. Please try again later.")}
  finally{setBusy(false)}
 }
 return <main className="grid min-h-screen place-items-center bg-[#050812] bg-[radial-gradient(ellipse_at_top_left,#123c4c,transparent_65%)] px-5 py-12 text-white">
  {ready&&!owner&&<Script src="https://cdn.paddle.com/paddle/v2/paddle.js" onReady={()=>setLoaded(true)} onError={()=>setMessage("Checkout could not load. Please refresh the page.")}/>}
  <Card className="w-full max-w-xl rounded-3xl border-cyan-300/30 bg-gradient-to-br from-[#102835] to-[#211c36] p-7 text-white sm:p-10">
   <p className="text-sm uppercase tracking-widest text-cyan-200">Orbit LM · Your next chapter</p>
   <h1 className="mt-4 text-3xl font-semibold">{name}</h1>
   <p className="mt-5 text-4xl font-semibold">US$ {monthlyUsd.toFixed(2)}<span className="text-base font-normal text-slate-300"> / month</span></p>
   <p className="mt-4 text-sm leading-6 text-slate-300">Renews monthly until canceled. Any applicable taxes, local currency and final total are shown in Paddle checkout before you pay.</p>
   <p className="my-5 break-all rounded-xl border border-cyan-200/20 p-3 text-sm">Plan access will be attached to <strong>{email}</strong>.</p>
   {owner?<p className="text-cyan-100">Your owner account already has full access. No payment is needed.</p>:
   !ready?<p role="status" className="text-cyan-100">Subscriptions are being prepared. Checkout is not open yet, and no payment has been taken.</p>:
   <Button className="w-full" disabled={!loaded||busy||waiting||active} onClick={openCheckout}>{busy?"Preparing checkout…":waiting?"Confirming payment…":active?"Plan activated":"Continue to secure checkout"}</Button>}
   {message&&<p role="status" className="mt-5 text-sm text-cyan-100">{message}</p>}
   <div className="mt-7 flex flex-wrap gap-5 text-sm"><a className="text-cyan-200 underline" href="/dashboard">Open dashboard</a><a className="text-slate-300 underline" href="https://orbit-landing-page-rose.vercel.app/#plans">Compare plans</a><a className="text-slate-300 underline" href="/billing">Manage billing</a></div>
  </Card>
 </main>
}
