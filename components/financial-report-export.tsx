"use client"
import {useRef,useState} from "react"
import {Download,FileText,Printer} from "lucide-react"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "@/components/ui/dialog"
import {createFinancialReport,type ReportRow} from "@/lib/financial-report"
type Props={preparedFor:string;currency:string;language?:string}
const date=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
export function FinancialReportExport(props:Props){
 const [open,setOpen]=useState(false),[title,setTitle]=useState("Financial performance report"),[start,setStart]=useState(()=>{const now=new Date();return date(new Date(now.getFullYear(),now.getMonth()-11,1))}),[end,setEnd]=useState(()=>date(new Date()))
 const [report,setReport]=useState<ReturnType<typeof createFinancialReport>|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[ready,setReady]=useState(false)
 const frame=useRef<HTMLIFrameElement>(null)
 async function generate(){
  setError("");setBusy(true);setReport(null);setReady(false)
  try{
   const response=await fetch("/api/reports/export-data",{cache:"no-store"}),payload=await response.json()
   if(!response.ok)throw Error(payload.error||"Could not load the complete report data.")
   const data=payload.data,holdings=data.holdings.map((r:ReportRow)=>({...r,quote_currency:r.quote_currency||data.portfolios.find((p:ReportRow)=>p.id===r.portfolio_id)?.currency||r.currency||"USD"}))
   const rows=[...data.payments,...data.projects,...data.leads,...data.expenses,...data.groceries,...holdings]
   const codes=[...new Set<string>(rows.map((r:ReportRow)=>String(r.quote_currency||r.currency||props.currency).toUpperCase()))]
   const rates=Object.fromEntries(await Promise.all(codes.map(async code=>{
    if(code===props.currency)return [code,1]
    const result=await fetch(`/api/fx?from=${encodeURIComponent(code)}&to=${encodeURIComponent(props.currency)}`),fx=await result.json()
    if(!result.ok||!Number.isFinite(Number(fx.rate))||Number(fx.rate)<=0)throw Error(`Currency conversion for ${code} is unavailable. Please try again before exporting.`)
    return [code,Number(fx.rate)]
   })))
   const convert=(amount:unknown,row:ReportRow)=>Number(amount||0)*rates[String(row.quote_currency||row.currency||props.currency).toUpperCase()]
   setReport(createFinancialReport({...props,...data,holdings,title,start,end,convert}))
  }catch(e){setError(e instanceof Error?e.message:"We could not create this report. Please try again.")}
  finally{setBusy(false)}
 }
 function download(){
  if(!report)return
  const url=URL.createObjectURL(new Blob([report.html],{type:"text/html;charset=utf-8"})),link=document.createElement("a")
  link.href=url;link.download=report.filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000)
 }
 function print(){
  if(!frame.current?.contentWindow)return
  try{frame.current.contentWindow.focus();frame.current.contentWindow.print()}catch{setError("Printing is unavailable here. Download the report, open it in your browser, and choose Print → Save as PDF.")}
 }
 return <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/[.04] p-4">
  <div><h2 className="font-semibold text-white">Financial reporting</h2><p className="text-xs text-slate-400">Turn your workspace records into a clear, shareable financial report.</p></div>
  <Button type="button" onClick={()=>{setOpen(true);setReport(null);setError("");setReady(false)}}><FileText size={16}/>Export financial report</Button>
  <Dialog open={open} onOpenChange={value=>{setOpen(value);if(!value)setReport(null)}}>
   <DialogContent className="flex max-h-[94dvh] w-[calc(100%_-_1rem)] max-w-6xl flex-col overflow-y-auto border-cyan-300/25 bg-[#0b1524] text-white sm:max-w-6xl">
    <DialogHeader><DialogTitle>Export financial report</DialogTitle><DialogDescription className="text-slate-400">Choose a period, preview your report, then download it or save it as PDF. Ledger search filters do not limit this export.</DialogDescription></DialogHeader>
    <div className="grid gap-3 sm:grid-cols-4">
     <label className="text-xs text-slate-400 sm:col-span-2">Report title<Input value={title} maxLength={160} onChange={e=>{setTitle(e.target.value);setReport(null)}}/></label>
     <label className="text-xs text-slate-400">From<Input type="date" value={start} max={end} onChange={e=>{setStart(e.target.value);setReport(null)}}/></label>
     <label className="text-xs text-slate-400">To<Input type="date" value={end} min={start} onChange={e=>{setEnd(e.target.value);setReport(null)}}/></label>
    </div>
    <p className="text-xs text-slate-400">Currency: {props.currency} · Includes income, expenses, groceries, receivables, projects, investments and monthly trends. Investment values use recorded prices. The document headings are in English; number formatting follows your language setting.</p>
    <div className="flex flex-wrap gap-2">
     <Button type="button" disabled={busy} onClick={generate}>{busy?"Preparing report…":"Generate preview"}</Button>
     {report&&<><Button type="button" variant="outline" onClick={download}><Download size={16}/>Download report (.html)</Button><Button type="button" variant="outline" disabled={!ready} onClick={print}><Printer size={16}/>Print / Save as PDF</Button></>}
    </div>
    {error&&<p role="alert" className="rounded-lg border border-red-300/25 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
    {report&&<><p className="text-xs text-amber-200">Confidential: this file contains financial information from your accessible workspace records. Share it only with trusted recipients.</p><iframe ref={frame} onLoad={()=>setReady(true)} title="Financial report preview" sandbox="allow-same-origin allow-modals" srcDoc={report.html} className="min-h-[55dvh] w-full flex-1 rounded-xl border border-white/10 bg-white"/></>}
   </DialogContent>
  </Dialog>
 </div>
}
