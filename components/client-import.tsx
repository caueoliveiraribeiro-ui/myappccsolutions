"use client"
import {useRef,useState} from "react"
import {Button} from "@/components/ui/button"
import {parseClientRows,parseClientCsv,ClientImportRow} from "@/lib/client-import"
export function ClientImport({onImported}:{onImported:(items:Record<string,any>[])=>void}){
 const input=useRef<HTMLInputElement>(null)
 const [rows,setRows]=useState<ClientImportRow[]|null>(null),[issues,setIssues]=useState<string[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState("")
 async function choose(file?:File){
  if(!file)return;setMessage("");setRows(null);setIssues([])
  if(!/\.(xlsx|csv)$/i.test(file.name)){setMessage("Choose an Excel .xlsx or Google Sheets .csv file.");return}
  if(file.size>2*1024*1024){setMessage("Choose a spreadsheet smaller than 2 MB.");return}
  setBusy(true)
  try{const result=file.name.toLowerCase().endsWith(".csv")?parseClientCsv(await file.text()):parseClientRows(await (await import("read-excel-file/universal")).readSheet(file));setRows(result.clients);setIssues(result.issues)}
  catch(error){setMessage(error instanceof Error?error.message:"Could not read the Excel sheet.")}
  finally{setBusy(false)}
 }
 async function save(){
  if(!rows?.length||busy)return;setBusy(true)
  try{const response=await fetch("/api/clients/import",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({clients:rows})});const data=await response.json();if(!response.ok)throw Error(data.error||"Import failed.");onImported(data.items||[]);setMessage(`${data.imported} clients imported · ${data.skipped} existing emails skipped.`);setRows(null)}
  catch(error){setMessage(error instanceof Error?error.message:"Import failed.")}
  finally{setBusy(false)}
 }
 return <div>
  <input ref={input} type="file" accept=".xlsx,.csv" className="hidden" onChange={event=>{void choose(event.target.files?.[0]);event.target.value=""}}/>
  <Button type="button" disabled={busy} onClick={()=>input.current?.click()}>{busy?"Processing…":"Import clients"}</Button>
  <p className="mt-1 max-w-xs text-xs text-slate-400">Excel (.xlsx) or Google Sheets: File → Download → CSV. Columns: Name, Email, Phone.</p>
  {message&&<p role="status" className="mt-2 max-w-sm text-xs text-blue-200">{message}</p>}
  {rows&&<div role="dialog" aria-modal="true" aria-label="Import clients" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4"><div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-blue-300/30 bg-[#0b1320] p-5 text-white">
    <h2 className="font-semibold">Import clients</h2><p className="my-3 text-sm text-slate-400">Google Sheets: File → Download → Comma-separated values (.csv), then upload here. Excel (.xlsx) is also supported. Only Name, Email and Phone will be imported. Existing emails are skipped. Format phone cells as Text in Excel to preserve + signs and leading zeros.</p>
    <p className="mb-3 text-sm">{rows.length} valid clients · {issues.length} skipped rows</p>
    <div className="max-h-64 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th>Name</th><th>Email</th><th>Phone</th></tr></thead><tbody>{rows.slice(0,100).map(row=><tr key={row.email} className="border-t border-white/10"><td className="p-2">{row.name}</td><td className="p-2">{row.email}</td><td className="p-2">{row.phone}</td></tr>)}</tbody></table></div>
    {rows.length>100&&<p className="text-xs">Preview shows the first 100 rows.</p>}
    {issues.length>0&&<div className="my-3 text-xs text-amber-200">{issues.slice(0,20).map(issue=><p key={issue}>{issue}</p>)}</div>}
    {message&&<p role="alert" className="mt-3 text-sm text-amber-200">{message}</p>}
    <div className="mt-4 flex gap-2"><Button disabled={busy||!rows.length} onClick={save}>{busy?"Importing…":"Confirm import"}</Button><Button disabled={busy} variant="outline" onClick={()=>setRows(null)}>Cancel</Button></div>
  </div></div>}
 </div>
}

