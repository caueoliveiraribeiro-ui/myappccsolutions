"use client"
import { useState } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
export function PermanentDeleteButton({resource,id,onDeleted}:{resource:string;id:string;onDeleted?:()=>void}) {
 const [busy,setBusy]=useState(false)
 return <button type="button" disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-400/40 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-400/10 disabled:opacity-50" onClick={async()=>{
  if(busy || prompt("Permanently delete this archived record? This cannot be undone. Linked clients, projects, invoices and payments will not be deleted. Type DELETE to confirm.")!=="DELETE")return
  setBusy(true)
  try{const r=await fetch("/api/data/"+resource,{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({id,permanent:true,confirmation:"DELETE"})});const d=await r.json();if(!r.ok)throw Error(d.error||"Could not delete this record.");toast.success("Archived record permanently deleted.");onDeleted?.();window.dispatchEvent(new CustomEvent("orbit:records-changed",{detail:{resource}}));window.dispatchEvent(new Event("focus"))}catch(e){toast.error(e instanceof Error?e.message:"Could not delete this record.")}finally{setBusy(false)}
 }}><Trash2 size={14}/>{busy?"Deleting…":"Delete permanently"}</button>
}
