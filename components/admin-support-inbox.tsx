"use client"

import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { CheckCircle2, Inbox, LifeBuoy, MessageCircleMore, RefreshCw, Send, UserRound } from "lucide-react"
import { orbitEase } from "@/components/motion-ui"

type Conversation = {
  id: string
  status: "open" | "pending" | "resolved"
  subject: string
  human_requested: boolean
  last_message_at: string
  created_at: string
  member?: { id: string; name?: string; email?: string } | null
}

type Message = {
  id: string
  sender: "user" | "orbit_ai" | "support_agent" | "system"
  content: string
  created_at: string
}

export function AdminSupportInbox() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<string>("")
  const [messages, setMessages] = useState<Message[]>([])
  const [member, setMember] = useState<any>(null)
  const [status, setStatus] = useState("all")
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const active = useMemo(() => conversations.find((item) => item.id === selected) || null, [conversations, selected])

  async function loadList(nextStatus = status) {
    setError("")
    const r = await fetch(`/api/admin/support?status=${encodeURIComponent(nextStatus)}`, { cache: "no-store" })
    const d = await r.json()
    if (!r.ok) throw Error(d.error || "Could not load Support Inbox.")
    setConversations(d.conversations || [])
    if (!selected && d.conversations?.[0]?.id) setSelected(d.conversations[0].id)
  }

  async function loadConversation(id: string) {
    if (!id) return
    setError("")
    const r = await fetch(`/api/admin/support?id=${encodeURIComponent(id)}`, { cache: "no-store" })
    const d = await r.json()
    if (!r.ok) throw Error(d.error || "Could not load conversation.")
    setMessages(d.messages || [])
    setMember(d.member || null)
  }

  useEffect(() => {
    loadList().catch((e) => setError(e instanceof Error ? e.message : "Could not load Support Inbox."))
  }, [status])

  useEffect(() => {
    if (!selected) return
    loadConversation(selected).catch((e) => setError(e instanceof Error ? e.message : "Could not load conversation."))
  }, [selected])

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadList().catch(() => {})
      if (selected) loadConversation(selected).catch(() => {})
    }, 15000)
    return () => window.clearInterval(timer)
  }, [selected, status])

  async function reply() {
    if (!selected || !draft.trim() || busy) return
    setBusy(true)
    setError("")
    try {
      const r = await fetch("/api/admin/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: selected, content: draft.trim() }),
      })
      const d = await r.json()
      if (!r.ok) throw Error(d.error || "Could not send reply.")
      setDraft("")
      await Promise.all([loadConversation(selected), loadList()])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send reply.")
    } finally {
      setBusy(false)
    }
  }

  async function updateStatus(next: "open" | "pending" | "resolved") {
    if (!selected || busy) return
    setBusy(true)
    setError("")
    try {
      const r = await fetch("/api/admin/support", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: selected, status: next }),
      })
      const d = await r.json()
      if (!r.ok) throw Error(d.error || "Could not update conversation.")
      await loadList()
      await loadConversation(selected)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update conversation.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#050812] px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-cyan-200/70"><LifeBuoy size={15}/> Orbit Administration</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-.03em]">Support Inbox</h1>
            <p className="mt-2 text-sm text-slate-400">Customer conversations, AI responses, human handoff and ticket status in one place.</p>
          </div>
          <button onClick={() => loadList().catch(()=>{})} className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-4 text-sm text-slate-200 hover:bg-white/[.07]"><RefreshCw size={15}/> Refresh</button>
        </div>

        {error && <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}

        <div className="grid min-h-[720px] overflow-hidden rounded-[30px] border border-white/[.08] bg-[#07101c] shadow-[0_28px_100px_rgba(0,0,0,.35)] lg:grid-cols-[360px_1fr]">
          <aside className="border-b border-white/[.08] bg-[#08121f] lg:border-b-0 lg:border-r">
            <div className="border-b border-white/[.08] p-4">
              <div className="grid grid-cols-4 gap-2">
                {["all","open","pending","resolved"].map((item)=><button key={item} onClick={()=>setStatus(item)} className={`rounded-xl px-2 py-2 text-[11px] font-medium capitalize transition ${status===item?"bg-cyan-300 text-slate-950":"bg-white/[.04] text-slate-400 hover:bg-white/[.07]"}`}>{item}</button>)}
              </div>
            </div>
            <div className="max-h-[660px] overflow-y-auto p-2">
              {!conversations.length && <div className="grid min-h-52 place-items-center text-center text-sm text-slate-500"><div><Inbox className="mx-auto mb-3"/>No support conversations yet.</div></div>}
              {conversations.map((item)=><button key={item.id} onClick={()=>setSelected(item.id)} className={`mb-2 w-full rounded-2xl border p-3 text-left transition ${selected===item.id?"border-cyan-300/35 bg-cyan-300/[.08]":"border-white/[.06] bg-white/[.025] hover:bg-white/[.05]"}`}>
                <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-100">{item.member?.name || item.member?.email || "Orbit member"}</p><p className="mt-0.5 truncate text-xs text-slate-500">{item.subject || "Orbit Support"}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase ${item.human_requested?"bg-amber-300/10 text-amber-200":"bg-white/[.05] text-slate-400"}`}>{item.human_requested?"Human":""+item.status}</span></div>
                <p className="mt-3 text-[10px] text-slate-600">{new Date(item.last_message_at).toLocaleString()}</p>
              </button>)}
            </div>
          </aside>

          <section className="flex min-h-0 flex-col">
            {!active ? <div className="grid flex-1 place-items-center text-center"><div className="max-w-sm"><MessageCircleMore className="mx-auto text-cyan-300" size={32}/><p className="mt-4 font-semibold">Select a conversation</p><p className="mt-2 text-sm text-slate-500">Customer messages and Orbit responses will appear here.</p></div></div> : <>
              <div className="flex flex-col gap-3 border-b border-white/[.08] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-200"><UserRound size={19}/></div><div><p className="font-semibold">{member?.name || "Orbit member"}</p><p className="text-xs text-slate-500">{member?.email || active.id}</p></div></div>
                <div className="flex flex-wrap gap-2">{(["open","pending","resolved"] as const).map((item)=><button key={item} disabled={busy} onClick={()=>updateStatus(item)} className={`rounded-xl px-3 py-2 text-xs capitalize ${active.status===item?"bg-cyan-300 text-slate-950":"border border-white/10 bg-white/[.03] text-slate-400"}`}>{item}</button>)}</div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <AnimatePresence initial={false}>{messages.map((message)=><motion.div key={message.id} initial={{opacity:0,y:5}} animate={{opacity:1,y:0}} transition={{duration:.25,ease:orbitEase}} className={`mb-3 flex ${message.sender==="user"?"justify-start":"justify-end"}`}><div className={`max-w-[82%] rounded-[20px] px-4 py-3 ${message.sender==="user"?"rounded-bl-md border border-white/[.08] bg-white/[.05] text-slate-200":message.sender==="support_agent"?"rounded-br-md bg-cyan-300 text-slate-950":"rounded-br-md border border-violet-300/15 bg-violet-300/[.08] text-violet-100"}`}><div className="mb-1 text-[9px] font-semibold uppercase tracking-[.15em] opacity-60">{message.sender==="user"?"Customer":message.sender==="support_agent"?"Support":"Orbit"}</div><p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p><p className="mt-2 text-[9px] opacity-45">{new Date(message.created_at).toLocaleString()}</p></div></motion.div>)}</AnimatePresence>
              </div>

              <div className="border-t border-white/[.08] bg-[#08121f] p-4">
                <div className="rounded-2xl border border-white/10 bg-white/[.035] p-2 focus-within:border-cyan-300/35"><textarea value={draft} onChange={(e)=>setDraft(e.target.value.slice(0,4000))} placeholder="Reply as Orbit Support…" rows={3} className="w-full resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-slate-600"/><div className="flex items-center justify-between gap-3 px-1 pb-1"><span className="flex items-center gap-1.5 text-[10px] text-slate-600"><CheckCircle2 size={12}/> Replies are stored in Orbit</span><button disabled={busy||!draft.trim()} onClick={reply} className="inline-flex h-10 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-slate-950 disabled:opacity-40"><Send size={15}/>{busy?"Sending…":"Send reply"}</button></div></div>
              </div>
            </>}
          </section>
        </div>
      </div>
    </main>
  )
}
