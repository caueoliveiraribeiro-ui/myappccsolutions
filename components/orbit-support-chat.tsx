"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  ArrowUp,
  Bot,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  LifeBuoy,
  LockKeyhole,
  MessageCircleMore,
  Minimize2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react"
import { orbitEase } from "@/components/motion-ui"

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  mode?: "knowledge"
  suggestions?: string[]
  needsHuman?: boolean
}

type Me = {
  name?: string
  access?: {
    plan?: string
    features?: string[]
  }
}

const starterPrompts = [
  { label: "Using Orbit", prompt: "How do I use Orbit?", icon: Sparkles },
  { label: "Billing & plans", prompt: "Help me with billing and plans", icon: ShieldCheck },
  { label: "Account help", prompt: "I need help with my account", icon: LockKeyhole },
  { label: "Report a problem", prompt: "Something in Orbit is not working", icon: LifeBuoy },
]

const welcomeMessage: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "I’m here to help with Orbit features, account access, billing, integrations and troubleshooting. What would you like to do?",
  mode: "knowledge",
}

function messageId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function OrbitSupportChat() {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([welcomeMessage])
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [me, setMe] = useState<Me>({})
  const launcherRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("orbit-support-conversation")
      if (!saved) return
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length) setMessages(parsed.slice(-40))
    } catch {}
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem("orbit-support-conversation", JSON.stringify(messages.slice(-40)))
    } catch {}
  }, [messages])

  useEffect(() => {
    if (!open) return
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

  function resetConversation() {
    setMessages([welcomeMessage])
    setDraft("")
    try {
      sessionStorage.removeItem("orbit-support-conversation")
    } catch {}
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  async function sendMessage(raw: string) {
    const message = raw.trim()
    if (!message || sending) return

    const userMessage: Message = { id: messageId(), role: "user", content: message }
    setMessages((current) => [...current, userMessage])
    setDraft("")
    setSending(true)

    try {
      const response = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message,
          context: {
            plan: me.access?.plan,
            features: me.access?.features,
          },
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Orbit Support is temporarily unavailable.")
      setMessages((current) => [
        ...current,
        {
          id: messageId(),
          role: "assistant",
          content: String(data.reply || "I’m here to help."),
          mode: data.mode === "knowledge" ? "knowledge" : undefined,
          suggestions: Array.isArray(data.suggestions) ? data.suggestions.slice(0, 3) : undefined,
          needsHuman: Boolean(data.needsHuman),
        },
      ])
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: messageId(),
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Orbit Support is temporarily unavailable. Please try again in a moment.",
        },
      ])
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
            role="dialog"
            aria-modal="false"
            aria-label="Orbit Support"
            initial={reduce ? false : { opacity: 0, y: 18, scale: 0.965 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.975 }}
            transition={reduce ? { duration: 0 } : { duration: 0.34, ease: orbitEase }}
            className="pointer-events-auto absolute bottom-[92px] right-4 flex h-[min(650px,calc(100dvh-120px))] w-[min(400px,calc(100vw-32px))] flex-col overflow-hidden rounded-[28px] border border-cyan-300/20 bg-[#07101d]/95 text-white shadow-[0_28px_90px_rgba(0,0,0,.58),0_0_44px_rgba(34,211,238,.14)] backdrop-blur-2xl sm:right-6"
          >
            <div className="relative overflow-hidden border-b border-white/10 px-5 pb-4 pt-5">
              <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-cyan-300/15 blur-3xl" />
              <div className="pointer-events-none absolute -left-20 top-8 h-36 w-36 rounded-full bg-violet-500/10 blur-3xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <motion.div
                    animate={reduce ? undefined : { rotate: [0, 5, 0, -4, 0] }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                    className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-200/30 bg-cyan-300 text-slate-950 shadow-[0_0_26px_rgba(34,211,238,.35)]"
                  >
                    <Sparkles size={23} />
                    <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#07101d] bg-emerald-400" />
                  </motion.div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-[15px] font-semibold tracking-tight">Orbit Assistant</h2>
                      <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-medium text-cyan-100">
                        Knowledge mode
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">Native Orbit support · AI-ready</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={resetConversation}
                    title="Start a new conversation"
                    aria-label="Start a new conversation"
                    className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition hover:bg-white/7 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                  >
                    <RotateCcw size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Minimize Orbit Support"
                    className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition hover:bg-white/7 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                  >
                    <Minimize2 size={17} />
                  </button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 [scrollbar-color:rgba(103,232,249,.25)_transparent] [scrollbar-width:thin]">
              {messages.length <= 1 && (
                <div className="mb-5 rounded-2xl border border-white/8 bg-white/[.035] p-4">
                  <p className="text-xs font-medium uppercase tracking-[.2em] text-cyan-200/70">Hi {firstName}</p>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight">How can Orbit help today?</h3>
                  <p className="mt-1.5 text-sm leading-6 text-slate-400">
                    Choose a topic or ask a question in your own words.
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {starterPrompts.map(({ label, prompt, icon: Icon }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => void sendMessage(prompt)}
                        className="group flex min-h-[74px] flex-col justify-between rounded-2xl border border-white/8 bg-white/[.035] p-3 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-cyan-300/[.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                      >
                        <Icon size={17} className="text-cyan-300" />
                        <span className="mt-3 flex items-center justify-between gap-2 text-xs font-medium text-slate-200">
                          {label}
                          <ChevronRight size={14} className="text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-cyan-200" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3" aria-live="polite">
                {messages.map((message) => (
                  <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div className={message.role === "user" ? "max-w-[84%]" : "max-w-[92%]"}>
                      <div
                        className={
                          message.role === "user"
                            ? "rounded-[20px] rounded-br-md bg-cyan-300 px-4 py-3 text-sm leading-6 text-slate-950 shadow-[0_8px_24px_rgba(34,211,238,.12)]"
                            : "rounded-[20px] rounded-bl-md border border-white/8 bg-white/[.055] px-4 py-3 text-sm leading-6 text-slate-200"
                        }
                      >
                        {message.role === "assistant" && (
                          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.16em] text-cyan-200/75">
                            <Bot size={13} /> Orbit
                          </div>
                        )}
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </div>
                      {message.role === "assistant" && message.suggestions?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {message.suggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => void sendMessage(suggestion)}
                              className="rounded-full border border-cyan-300/15 bg-cyan-300/[.055] px-2.5 py-1.5 text-[11px] text-cyan-100/85 transition hover:border-cyan-300/35 hover:bg-cyan-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {message.role === "assistant" && message.needsHuman ? (
                        <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-300/15 bg-amber-300/[.06] px-3 py-2 text-[11px] text-amber-100/80">
                          <UserRound size={14} /> Human handoff will plug into this conversation layer next.
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}

                {sending && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-[20px] rounded-bl-md border border-white/8 bg-white/[.055] px-4 py-3 text-xs text-slate-400">
                      <span className="flex gap-1" aria-label="Orbit is typing">
                        {[0, 1, 2].map((index) => (
                          <motion.span
                            key={index}
                            animate={reduce ? undefined : { opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                            transition={{ duration: 1, repeat: Infinity, delay: index * 0.14 }}
                            className="h-1.5 w-1.5 rounded-full bg-cyan-300"
                          />
                        ))}
                      </span>
                      Orbit is thinking
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            </div>

            <div className="border-t border-white/10 bg-[#07101d]/90 p-3.5">
              <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[.055] p-2 transition focus-within:border-cyan-300/35 focus-within:shadow-[0_0_24px_rgba(34,211,238,.08)]">
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value.slice(0, 2000))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault()
                      if (draft.trim()) void sendMessage(draft)
                    }
                  }}
                  rows={1}
                  maxLength={2000}
                  placeholder="Ask Orbit anything…"
                  aria-label="Message Orbit Support"
                  className="max-h-28 min-h-[46px] w-full resize-none bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-slate-500"
                />
                <div className="flex items-center justify-between gap-3 px-1 pb-1">
                  <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <ShieldCheck size={12} /> Don’t share passwords or private keys
                  </span>
                  <button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    aria-label="Send message"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-300 text-slate-950 shadow-[0_0_20px_rgba(34,211,238,.22)] transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <ArrowUp size={18} />
                  </button>
                </div>
              </form>
              <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-slate-600">
                <CheckCircle2 size={11} /> Native Orbit support · provider keys stay server-side
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="pointer-events-auto absolute bottom-4 right-4 sm:bottom-6 sm:right-6">
        <AnimatePresence>
          {!open && (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 5, scale: 0.97 }}
              transition={reduce ? { duration: 0 } : { duration: 0.3, ease: orbitEase }}
              className="flex items-center gap-2"
            >
              <motion.div
                animate={reduce ? undefined : { opacity: [0.72, 1, 0.72], y: [0, -2, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                className="hidden rounded-2xl border border-cyan-300/15 bg-[#07101d]/90 px-3.5 py-2 text-xs text-cyan-50 shadow-[0_12px_36px_rgba(0,0,0,.36)] backdrop-blur-xl sm:block"
              >
                Need help? <span className="font-semibold text-cyan-200">Ask Orbit.</span>
              </motion.div>
              <motion.button
                ref={launcherRef}
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Open Orbit Support"
                aria-haspopup="dialog"
                whileHover={reduce ? undefined : { scale: 1.06, rotate: 2 }}
                whileTap={reduce ? undefined : { scale: 0.96 }}
                className="relative grid h-[60px] w-[60px] place-items-center overflow-hidden rounded-[21px] border border-cyan-200/30 bg-[#081421] text-cyan-100 shadow-[0_18px_48px_rgba(0,0,0,.45),0_0_30px_rgba(34,211,238,.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050812]"
              >
                <motion.span
                  aria-hidden="true"
                  animate={reduce ? undefined : { rotate: 360 }}
                  transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-[5px] rounded-[17px] border border-dashed border-cyan-300/35"
                />
                <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(103,232,249,.24),transparent_45%)]" />
                <MessageCircleMore size={26} className="relative z-10 drop-shadow-[0_0_8px_rgba(103,232,249,.55)]" />
                <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-[#081421] bg-emerald-400" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
