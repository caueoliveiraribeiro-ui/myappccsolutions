"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowUp, CheckCircle2, ChevronRight, LifeBuoy, LockKeyhole, MessageCircleMore, Minimize2, RotateCcw, ShieldCheck, Sparkles, UserRound } from "lucide-react"
import { orbitEase } from "@/components/motion-ui"

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  sender?: "user" | "orbit_ai" | "support_agent" | "system"
  mode?: "knowledge"
  suggestions?: string[]
  needsHuman?: boolean
}

type Me = { name?: string; access?: { plan?: string; features?: string[] } }

const starterPrompts = [
  { label: "Using Orbit", prompt: "How do I use Orbit?", icon: Sparkles },
  { label: "Billing & plans", prompt: "Help me with billing and plans", icon: ShieldCheck },
  { label: "Account help", prompt: "I need help with my account", icon: LockKeyhole },
  { label: "Report a problem", prompt: "Something in Orbit is not working", icon: LifeBuoy },
]

const welcomeMessage: Message = {
  id: "welcome",
  role: "assistant",
  sender: "system",
  content: "I’m here to help with Orbit features, account access, billing, integrations and troubleshooting. What would you like to do?",
  mode: "knowledge",
}

function messageId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function mapStoredMessage(row: any): Message {
  return {
    id: String(row.id),
    role: row.sender === "user" ? "user" : "assistant",
    sender: row.sender,
    content: String(row.content || ""),
  }
}

export function OrbitSupportChat() {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([welcomeMessage])
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [me, setMe] = useState<Me>({})
  const [authenticated, setAuthenticated] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [unreadHuman, setUnreadHuman] = useState(false)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const lastSupportReplyRef = useRef<string | null>(null)

  const firstName = useMemo(() => {
    const name = (me.name || "").trim().split(/\s+/)[0]
    return name || "there"
  }, [me.name])

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => data && setMe(data))
      .catch(() => {})
  }, [])

  async function syncConversation(silent = true) {
    try {
      const response = await fetch("/api/support/conversation", { cache: "no-store" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Could not load support conversation.")
      setAuthenticated(Boolean(data.authenticated))
      if (!data.authenticated) return
      setConversationId(data.conversation?.id || null)
      if (!Array.isArray(data.messages) || !data.messages.length) {
        if (!data.conversation) setMessages([welcomeMessage])
        return
      }

      const stored = data.messages.map(mapStoredMessage)
      const latestHuman = [...stored].reverse().find((item: Message) => item.sender === "support_agent")
      if (latestHuman && latestHuman.id !== lastSupportReplyRef.current) {
        if (lastSupportReplyRef.current && !open) setUnreadHuman(true)
        lastSupportReplyRef.current = latestHuman.id
      }
      setMessages(stored)
    } catch (error) {
      if (!silent) console.error(error)
    }
  }

  useEffect(() => {
    void syncConversation()
    const timer = window.setInterval(() => void syncConversation(), 10000)
    return () => window.clearInterval(timer)
  }, [open])

  useEffect(() => {
    if (authenticated) return
    try {
      const saved = sessionStorage.getItem("orbit-support-conversation")
      if (!saved) return
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length) setMessages(parsed.slice(-40))
    } catch {}
  }, [authenticated])

  useEffect(() => {
    if (authenticated) return
    try { sessionStorage.setItem("orbit-support-conversation", JSON.stringify(messages.slice(-40))) } catch {}
  }, [messages, authenticated])

  useEffect(() => {
    if (!open) return
    setUnreadHuman(false)
    const timer = window.setTimeout(() => inputRef.current?.focus(), reduce ? 0 : 220)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
        window.setTimeout(() => launcherRef.current?.focus(), 0)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [open, reduce])

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" })
  }, [messages, sending, open, reduce])

  function close() {
    setOpen(false)
    window.setTimeout(() => launcherRef.current?.focus(), 0)
  }

  async function resetConversation() {
    setDraft("")
    if (authenticated) {
      try {
        await fetch("/api/support/conversation", { method: "DELETE" })
        setConversationId(null)
        lastSupportReplyRef.current = null
      } catch {}
    } else {
      try { sessionStorage.removeItem("orbit-support-conversation") } catch {}
    }
    setMessages([welcomeMessage])
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  async function sendMessage(raw: string) {
    const message = raw.trim()
    if (!message || sending) return

    const optimistic: Message = { id: messageId(), role: "user", sender: "user", content: message }
    setMessages((current) => [...current, optimistic])
    setDraft("")
    setSending(true)

    try {
      const response = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, context: { plan: me.access?.plan, features: me.access?.features } }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Orbit Support is temporarily unavailable.")
      if (data.conversationId) setConversationId(String(data.conversationId))

      if (data.authenticated) {
        setAuthenticated(true)
        await syncConversation(false)
      } else {
        setMessages((current) => [...current, {
          id: messageId(), role: "assistant", sender: "orbit_ai",
          content: String(data.reply || "I’m here to help."),
          mode: data.mode === "knowledge" ? "knowledge" : undefined,
          suggestions: Array.isArray(data.suggestions) ? data.suggestions.slice(0, 3) : undefined,
          needsHuman: Boolean(data.needsHuman),
        }])
      }
    } catch (error) {
      setMessages((current) => [...current, {
        id: messageId(), role: "assistant", sender: "system",
        content: error instanceof Error ? error.message : "Orbit Support is temporarily unavailable. Please try again in a moment.",
      }])
    } finally {
      setSending(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    void sendMessage(draft)
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[90]">
      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog" aria-modal="false" aria-label="Orbit Support"
            initial={reduce ? false : { opacity: 0, y: 18, scale: 0.965 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.975 }}
            transition={reduce ? { duration: 0 } : { duration: 0.34, ease: orbitEase }}
            className="pointer-events-auto absolute bottom-[92px] right-4 flex h-[min(650px,calc(100dvh-120px))] w-[min(400px,calc(100vw-32px))] flex-col overflow-hidden rounded-[28px] border border-cyan-300/20 bg-[#07101d]/95 text-white shadow-[0_28px_90px_rgba(0,0,0,.58),0_0_44px_rgba(34,211,238,.14)] backdrop-blur-2xl sm:right-6"
          >
            <div className="relative overflow-hidden border-b border-white/10 px-5 pb-4 pt-5">
              <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-cyan-300/15 blur-3xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <motion.div animate={reduce ? undefined : { rotate: [0,5,0,-4,0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-200/30 bg-cyan-300 text-slate-950 shadow-[0_0_26px_rgba(34,211,238,.35)]">
                    <Sparkles size={23} /><span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#07101d] bg-emerald-400" />
                  </motion.div>
                  <div className="min-w-0">
                    <h2 className="truncate text-[15px] font-semibold tracking-tight">Orbit Support</h2>
                    <p className="mt-1 text-xs text-slate-400">{authenticated ? "Connected to your Orbit account" : "Help when you need it"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => void resetConversation()} title="Start a new conversation" aria-label="Start a new conversation" className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition hover:bg-white/7 hover:text-white"><RotateCcw size={16}/></button>
                  <button type="button" onClick={close} aria-label="Minimize Orbit Support" className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition hover:bg-white/7 hover:text-white"><Minimize2 size={17}/></button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 [scrollbar-color:rgba(103,232,249,.25)_transparent] [scrollbar-width:thin]">
              {messages.length <= 1 && (
                <div className="mb-5 rounded-2xl border border-white/8 bg-white/[.035] p-4">
                  <p className="text-xs font-medium uppercase tracking-[.2em] text-cyan-200/70">Hi {firstName}</p>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight">How can Orbit help today?</h3>
                  <p className="mt-1.5 text-sm leading-6 text-slate-400">Choose a topic or ask a question in your own words.</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {starterPrompts.map(({ label, prompt, icon: Icon }) => (
                      <button key={label} type="button" onClick={() => void sendMessage(prompt)} className="group flex min-h-[74px] flex-col justify-between rounded-2xl border border-white/8 bg-white/[.035] p-3 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-cyan-300/[.07]">
                        <Icon size={17} className="text-cyan-300"/><span className="mt-3 flex items-center justify-between gap-2 text-xs font-medium text-slate-200">{label}<ChevronRight size={14} className="text-slate-500"/></span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3" aria-live="polite">
                {messages.map((message) => (
                  <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div className={message.role === "user" ? "max-w-[84%]" : "max-w-[92%]"}>
                      <div className={message.role === "user" ? "rounded-[20px] rounded-br-md bg-cyan-300 px-4 py-3 text-sm leading-6 text-slate-950" : message.sender === "support_agent" ? "rounded-[20px] rounded-bl-md border border-emerald-300/20 bg-emerald-300/[.08] px-4 py-3 text-sm leading-6 text-emerald-50" : "rounded-[20px] rounded-bl-md border border-white/8 bg-white/[.055] px-4 py-3 text-sm leading-6 text-slate-200"}>
                        {message.role === "assistant" && <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.16em] text-cyan-200/75"><MessageCircleMore size={13}/>{message.sender === "support_agent" ? "Orbit Support" : "Orbit"}</div>}
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </div>
                      {message.role === "assistant" && message.suggestions?.length ? <div className="mt-2 flex flex-wrap gap-1.5">{message.suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => void sendMessage(suggestion)} className="rounded-full border border-cyan-300/15 bg-cyan-300/[.055] px-2.5 py-1.5 text-[11px] text-cyan-100/85">{suggestion}</button>)}</div> : null}
                      {message.role === "assistant" && message.needsHuman ? <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-300/15 bg-amber-300/[.06] px-3 py-2 text-[11px] text-amber-100/80"><UserRound size={14}/> Your conversation has been flagged for human support.</div> : null}
                    </div>
                  </div>
                ))}
                {sending && <div className="flex justify-start"><div className="flex items-center gap-2 rounded-[20px] rounded-bl-md border border-white/8 bg-white/[.055] px-4 py-3 text-xs text-slate-400"><span className="flex gap-1">{[0,1,2].map((index)=><motion.span key={index} animate={reduce?undefined:{opacity:[.3,1,.3],y:[0,-2,0]}} transition={{duration:1,repeat:Infinity,delay:index*.14}} className="h-1.5 w-1.5 rounded-full bg-cyan-300"/>)}</span>Orbit is replying</div></div>}
                <div ref={endRef}/>
              </div>
            </div>

            <div className="border-t border-white/10 bg-[#07101d]/90 p-3.5">
              <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[.055] p-2 transition focus-within:border-cyan-300/35">
                <textarea ref={inputRef} value={draft} onChange={(e)=>setDraft(e.target.value.slice(0,2000))} onKeyDown={(e)=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();if(draft.trim())void sendMessage(draft)}}} rows={1} maxLength={2000} placeholder="Ask Orbit anything…" aria-label="Message Orbit Support" className="max-h-28 min-h-[46px] w-full resize-none bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-slate-500"/>
                <div className="flex items-center justify-between gap-3 px-1 pb-1"><span className="flex items-center gap-1.5 text-[10px] text-slate-500"><ShieldCheck size={12}/> Don’t share passwords or private keys</span><button type="submit" disabled={sending||!draft.trim()} aria-label="Send message" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-300 text-slate-950 disabled:opacity-40"><ArrowUp size={18}/></button></div>
              </form>
              <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-slate-600"><CheckCircle2 size={11}/>{authenticated && conversationId ? "Conversation synced with Orbit Support" : "Secure Orbit support"}</div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="pointer-events-auto absolute bottom-4 right-4 sm:bottom-6 sm:right-6">
        <AnimatePresence>{!open && <motion.div initial={reduce?false:{opacity:0,y:8,scale:.96}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:5,scale:.97}} transition={reduce?{duration:0}:{duration:.3,ease:orbitEase}} className="flex items-center gap-2">
          <motion.div animate={reduce?undefined:{opacity:[.72,1,.72],y:[0,-2,0]}} transition={{duration:4.5,repeat:Infinity,ease:"easeInOut"}} className="hidden rounded-2xl border border-cyan-300/15 bg-[#07101d]/90 px-3.5 py-2 text-xs text-cyan-50 shadow-[0_12px_36px_rgba(0,0,0,.36)] backdrop-blur-xl sm:block">{unreadHuman ? <span className="font-semibold text-emerald-200">New reply from Orbit Support</span> : <>Need help? <span className="font-semibold text-cyan-200">Ask Orbit.</span></>}</motion.div>
          <motion.button ref={launcherRef} type="button" onClick={()=>{setUnreadHuman(false);setOpen(true);void syncConversation()}} aria-label="Open Orbit Support" aria-haspopup="dialog" whileHover={reduce?undefined:{scale:1.06,rotate:2}} whileTap={reduce?undefined:{scale:.96}} className="relative grid h-[60px] w-[60px] place-items-center overflow-hidden rounded-[21px] border border-cyan-200/30 bg-[#081421] text-cyan-100 shadow-[0_18px_48px_rgba(0,0,0,.45),0_0_30px_rgba(34,211,238,.2)]">
            <motion.span aria-hidden="true" animate={reduce?undefined:{rotate:360}} transition={{duration:12,repeat:Infinity,ease:"linear"}} className="absolute inset-[5px] rounded-[17px] border border-dashed border-cyan-300/35"/><span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(103,232,249,.24),transparent_45%)]"/><MessageCircleMore size={26} className="relative z-10"/>{unreadHuman ? <span className="absolute right-0.5 top-0.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-[#081421] bg-emerald-400 px-1 text-[9px] font-bold text-slate-950">1</span> : <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-[#081421] bg-emerald-400"/>}
          </motion.button>
        </motion.div>}</AnimatePresence>
      </div>
    </div>
  )
}
