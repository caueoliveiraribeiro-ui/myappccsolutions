"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  BarChart3, Bitcoin, CalendarDays, Check, ChevronDown, Coins, Contact,
  FolderKanban, Search, ShieldCheck, ShoppingBasket, Sparkles, Target,
  TrendingUp, Users, WalletCards, Zap,
} from "lucide-react"

import { planCurrencies, priceInCurrency } from "@/lib/plan-pricing"

const featureCards = [
  [Contact, "Client studio", "Relationships in one place"],
  [Search, "Lead radar", "Find your next opportunity"],
  [FolderKanban, "Creative work", "Projects built to deliver"],
  [BarChart3, "Money clarity", "See every decision clearly"],
  [Coins, "Global markets", "Stocks and crypto together"],
  [CalendarDays, "Life calendar", "Make space for what matters"],
] as const

const plans = [
  {
    name: "Personal",
    usd: 19.99,
    eyebrow: "Build your foundation",
    icon: Target,
    description: "A beautiful command center for your money, investments and everyday life.",
    features: ["Overview dashboard", "Stocks", "Expenses", "Groceries", "Calendar"],
    accent: "cyan",
    featured: false,
  },
  {
    name: "Small Business",
    usd: 49.99,
    eyebrow: "Turn momentum into growth",
    icon: Zap,
    description: "Connect your personal system to the work, clients and projects moving your business forward.",
    features: ["Everything in Personal", "Crypto", "Projects", "History", "Lead management", "100 live leads", "50 archived leads", "Up to 50 clients"],
    accent: "violet",
    featured: true,
  },
  {
    name: "Big Business",
    usd: 99.99,
    eyebrow: "Operate at full scale",
    icon: TrendingUp,
    description: "A complete growth workspace for teams ready to find, nurture and convert more opportunities.",
    features: ["All Small Business features, with higher limits", "Tasks & follow-ups", "Sales pipeline", "300 live leads", "100 archived leads", "Unlimited clients"],
    accent: "blue",
    featured: false,
  },
] as const

export function LoginForm() {
  const router = useRouter()
  const [signup, setSignup] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [pricing, setPricing] = useState({currency:"USD",rate:1,date:"",fallback:false})
  const [requestedCurrency, setRequestedCurrency] = useState("")
  const [pricingBusy, setPricingBusy] = useState(true)
  const [locale, setLocale] = useState("en-US")
  useEffect(() => { setLocale(navigator.language || "en-US") }, [])
  useEffect(() => {
    const controller = new AbortController()
    setPricingBusy(true)
    fetch("/api/plan-pricing" + (requestedCurrency ? "?currency=" + requestedCurrency : ""), {signal:controller.signal})
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => { if (!controller.signal.aborted) setPricing(d) })
      .catch(() => { if (!controller.signal.aborted) setPricing({currency:"USD",rate:1,date:"",fallback:true}) })
      .finally(() => { if (!controller.signal.aborted) setPricingBusy(false) })
    return () => controller.abort()
  }, [requestedCurrency])
  const formatPrice = (usd: number) => new Intl.NumberFormat(locale, {style:"currency",currency:pricing.currency}).format(priceInCurrency(usd,pricing.rate))

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")
    const form = new FormData(event.currentTarget)
    const response = await fetch(signup ? "/api/auth/signup" : "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: form.get("name"), email: form.get("email"), password: form.get("password") }),
    })
    const data = await response.json()
    if (!response.ok) {
      setError(data.error || "We could not complete this request. Please check your details and try again.")
      setLoading(false)
      return
    }
    router.replace("/dashboard")
    router.refresh()
  }

  const openSignup = () => {
    setSignup(true)
    setError("")
    document.getElementById("access")?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <main className="orbit-home relative min-h-screen overflow-hidden bg-[#050812] text-white">
      <div className="orbit-art fixed inset-[-6%]" />
      <div className="login-aurora fixed inset-[-8%] bg-[radial-gradient(circle_at_16%_0%,rgba(34,211,238,.32),transparent_36%),radial-gradient(circle_at_84%_100%,rgba(139,92,246,.24),transparent_38%)]" />
      <div className="login-grid fixed inset-0" />
      <div className="login-orb fixed left-[8%] top-[18%]" />
      <div className="login-orb animation-delay-2 fixed bottom-[12%] right-[7%]" />

      <nav className="relative z-20 mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-6">
        <a href="#access" className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-300 text-slate-950 shadow-[0_0_30px_rgba(34,211,238,.4)]"><Sparkles size={24}/></span>
          <span><b className="block text-lg">Orbit LM</b><small className="text-cyan-200/60">Life Management</small></span>
        </a>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild><a href="#plans">Explore plans</a></Button>
          <Button className="bg-cyan-300 text-slate-950" onClick={openSignup}>Start your Orbit</Button>
        </div>
      </nav>

      <section id="access" className="relative z-10 mx-auto grid min-h-[760px] max-w-7xl place-items-center px-5 pb-20 pt-8">
        <div className="login-shell grid w-full max-w-5xl overflow-hidden rounded-[32px] border border-white/10 bg-white/[.055] shadow-[0_30px_90px_rgba(0,0,0,.48)] backdrop-blur-2xl lg:grid-cols-[1.15fr_.85fr]">
          <section className="relative hidden min-h-[680px] flex-col justify-between overflow-hidden border-r border-white/10 p-12 lg:flex">
            <div className="brand-scan relative w-fit pr-12">
              <div className="flex items-center gap-5">
                <div className="grid h-[76px] w-[76px] place-items-center rounded-[25px] bg-gradient-to-br from-cyan-200 via-cyan-300 to-blue-500 text-slate-950 shadow-[0_0_40px_rgba(34,211,238,.36)]"><Sparkles size={36}/></div>
                <div><b className="text-[28px] tracking-[-.04em]">Orbit LM</b><p className="mt-0.5 text-[15px] font-medium tracking-wide text-cyan-200/65">Life Management</p></div>
              </div>
              <Search aria-hidden className="brand-magnifier absolute left-0 top-3 text-cyan-100" strokeWidth={1.7} size={54}/>
            </div>
            <div className="relative z-10 pt-10">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100"><ShieldCheck size={14}/>Private by design</div>
              <h1 className="max-w-lg text-5xl font-semibold leading-[1.08] tracking-[-.04em]">Build your days.<br/><span className="bg-gradient-to-r from-cyan-200 via-cyan-300 to-violet-300 bg-clip-text text-transparent">Grow your future.</span></h1>
              <p className="mt-5 max-w-md text-base leading-7 text-slate-400">One private command center for the work you’re building, the money you’re growing, and the life you’re living.</p>
              <div className="mt-7 grid max-w-lg grid-cols-2 gap-3">
                {featureCards.map(([Icon, name, description], index) => (
                  <button type="button" onClick={openSignup} key={name} className="feature-chip group flex min-h-20 items-center gap-3 rounded-2xl border border-cyan-300/15 bg-white/[.045] p-3 text-left" style={{animationDelay:`${index * .35}s`}}>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-300/10"><Icon size={19} className="text-cyan-300"/></span>
                    <span><b className="block text-sm text-slate-100">{name}</b><small className="mt-0.5 block text-[10px] leading-4 text-slate-500">{description}</small></span>
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-600">Encrypted transport · Isolated records · Server-side verification</p>
          </section>

          <section className="flex min-h-[600px] items-center p-7 sm:p-12">
            <form onSubmit={submit} className="w-full">
              <div className="mb-8 flex items-center gap-3 lg:hidden"><div className="grid h-14 w-14 place-items-center rounded-[20px] bg-cyan-300 text-slate-950"><Sparkles size={27}/></div><div><b className="text-2xl">Orbit LM</b><p className="text-xs text-cyan-200/60">Life Management</p></div></div>
              <p className="text-sm text-cyan-300">{signup ? "Create your private Orbit" : "Welcome back"}</p>
              <h2 className="mt-2 text-3xl font-semibold">{signup ? "Create account" : "Sign in"}</h2>
              <p className="mt-2 text-sm text-slate-500">{signup ? "A private space designed around your goals." : "Step back into your command center."}</p>
              <div className="mt-8 space-y-4">
                {signup && <label className="block text-sm text-slate-300">Name<Input required name="name" className="mt-2 h-12" autoComplete="name"/></label>}
                <label className="block text-sm text-slate-300">Email<Input required name="email" type="email" className="mt-2 h-12" autoComplete="username"/></label>
                <label className="block text-sm text-slate-300">Password<Input required name="password" type="password" minLength={signup ? 12 : 1} className="mt-2 h-12" autoComplete={signup ? "new-password" : "current-password"}/></label>
                {error && <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}
                <Button disabled={loading} className="h-12 w-full bg-cyan-300 text-slate-950 shadow-[0_0_28px_rgba(34,211,238,.2)]">{loading ? "Please wait…" : signup ? "Create my Orbit" : "Enter my Orbit"}</Button>
                <Button type="button" variant="ghost" className="w-full text-slate-400" onClick={() => { setSignup(!signup); setError("") }}>{signup ? "Already have an account? Sign in" : "New here? Create your account"}</Button>
              </div>
            </form>
          </section>
        </div>
        <a href="#plans" className="mt-10 flex flex-col items-center gap-2 text-xs uppercase tracking-[.28em] text-cyan-200/60">Discover your plan<ChevronDown className="pricing-bounce" size={19}/></a>
      </section>

      <section id="plans" className="relative z-10 mx-auto max-w-7xl px-5 py-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-5 w-fit rounded-full border border-violet-300/20 bg-violet-300/10 px-4 py-2 text-xs uppercase tracking-[.25em] text-violet-200">One life. One operating system.</div>
          <h2 className="text-4xl font-semibold tracking-[-.04em] sm:text-6xl">Choose the Orbit that<br/><span className="bg-gradient-to-r from-cyan-200 via-blue-300 to-violet-300 bg-clip-text text-transparent">moves you forward.</span></h2>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-400">Start with clarity. Expand into your business. Scale into a complete growth engine—all inside the same thoughtful workspace.</p>
        </div>

        <div className="mt-8 text-center">
          <label className="text-sm text-cyan-100">Display currency <select aria-label="Plan currency" value={requestedCurrency} onChange={e=>setRequestedCurrency(e.target.value)} className="ml-2 min-h-11 rounded-xl border border-cyan-300/30 bg-[#101827] px-3"><option value="">Your local currency</option>{planCurrencies.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
          <p role="status" className="mt-3 text-xs text-slate-400">{pricingBusy ? "Updating local prices…" : pricing.fallback ? "Local conversion is temporarily unavailable. Prices shown in USD." : pricing.currency==="USD" ? "Monthly prices in USD." : `Approximate monthly prices in ${pricing.currency} · exchange rate dated ${pricing.date || "latest available"}.`}</p>
          <p className="mt-2 text-xs text-slate-500">USD base prices. Local equivalents are estimates; no checkout or plan restrictions are enabled yet.</p>
        </div>
        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {plans.map((plan, index) => {
            const Icon = plan.icon
            return (
              <article key={plan.name} className={`pricing-card relative overflow-hidden rounded-[30px] border p-7 text-center backdrop-blur-xl ${plan.featured ? "border-violet-300/40 bg-violet-300/[.09] lg:-translate-y-5" : "border-cyan-300/20 bg-white/[.045]"}`} style={{animationDelay:`${index * .5}s`}}>
                <div className="pricing-glow absolute -right-16 -top-16 h-44 w-44 rounded-full bg-cyan-300/15 blur-3xl"/>
                {plan.featured && <span className="absolute right-5 top-5 rounded-full border border-violet-200/25 bg-violet-300/15 px-3 py-1 text-[10px] uppercase tracking-[.2em] text-violet-100">Most versatile</span>}
                <div className="relative">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-300/20 to-violet-300/20 text-cyan-200"><Icon size={25}/></div>
                  <p className="mt-7 text-xs uppercase tracking-[.22em] text-cyan-200/60">{plan.eyebrow}</p>
                  <h3 className="mt-2 text-3xl font-semibold">{plan.name}</h3>
                  <p className="mt-4 text-3xl font-semibold text-cyan-100">{pricingBusy ? "…" : formatPrice(plan.usd)}<span className="ml-1 text-sm font-normal text-slate-400">/ month</span></p>
                  <p className="mt-4 min-h-20 text-sm leading-6 text-slate-400">{plan.description}</p>
                  <div className="my-7 h-px bg-gradient-to-r from-cyan-300/30 via-white/10 to-transparent"/>
                  <ul className="space-y-3">
                    {plan.features.map(feature => <li key={feature} className="flex items-center justify-center gap-3 text-sm text-slate-200"><span className="grid h-6 w-6 place-items-center rounded-full bg-cyan-300/10 text-cyan-300"><Check size={14}/></span>{feature}</li>)}
                  </ul>
                  <Button onClick={openSignup} className={`mt-8 h-12 w-full ${plan.featured ? "bg-gradient-to-r from-cyan-300 to-violet-300 text-slate-950" : "border border-cyan-300/25 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/20"}`}>Choose your direction</Button>
                </div>
              </article>
            )
          })}
        </div>

        <div className="pricing-cta mt-16 overflow-hidden rounded-[34px] border border-cyan-300/25 bg-gradient-to-r from-cyan-300/[.12] via-blue-400/[.08] to-violet-400/[.14] p-8 text-center sm:p-12">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-cyan-300 text-slate-950 shadow-[0_0_45px_rgba(34,211,238,.4)]"><WalletCards size={28}/></div>
          <h3 className="mt-6 text-3xl font-semibold sm:text-4xl">Your business is unique. Your Orbit can be too.</h3>
          <p className="mx-auto mt-4 max-w-2xl text-slate-400">Imagine your brand, your workflows, and your team—connected in one workspace built around the way you do business. Let’s create your custom Orbit.</p>
          <p className="mt-7 text-lg font-semibold text-cyan-200">Your brand. Your workflows. Your Orbit.</p>
        </div>
      </section>
    </main>
  )
}
