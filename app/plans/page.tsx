import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CircleDollarSign,
  Gem,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Plans | Orbit LM",
  description:
    "Compare Orbit LM plans for personal organization, small businesses, growing teams, and custom business workflows.",
  alternates: { canonical: "https://orbit-lm.com/plans" },
}

const plans = [
  {
    key: "personal",
    index: "01 / YOUR FOUNDATION",
    name: "Personal",
    description:
      "Bring a little more intention to your work, money, and everyday life.",
    was: "$39.99",
    price: "$29.99",
    suffix: "/ month",
    heading: "Your everyday essentials",
    features: [
      "Overview dashboard",
      "Stocks & portfolios",
      "Projects",
      "Expenses & groceries",
      "Calendar",
    ],
    foot: "A clearer foundation for everyday life.",
    featured: false,
    icon: CircleDollarSign,
  },
  {
    key: "small_business",
    index: "02 / YOUR MOMENTUM",
    name: "Small Business",
    description:
      "Connect your personal world to the clients and projects moving you forward.",
    was: "$149.99",
    price: "$99.99",
    suffix: "/ month",
    heading: "Everything in Personal, plus",
    features: [
      "Crypto tracking",
      "Clients & lead management",
      "History & financial reports",
      "100 live leads · 50 archived",
      "Up to 50 clients",
    ],
    foot: "A connected workspace for independent business.",
    featured: true,
    icon: BriefcaseBusiness,
  },
  {
    key: "big_business",
    index: "03 / YOUR NEXT LEVEL",
    name: "Big Business",
    description:
      "Give your growing operation more room to follow through and move forward.",
    was: "$299.99",
    price: "$189.99",
    suffix: "/ month",
    heading: "Everything in Small Business, plus",
    features: [
      "Tasks & follow-ups",
      "Sales pipeline",
      "300 live leads",
      "100 archived leads",
      "Up to 100 clients",
    ],
    foot: "More capacity. More coordination. One Orbit.",
    featured: false,
    icon: Gem,
  },
] as const

const customizationFeatures = [
  "Your visual identity and branding",
  "Workflows tailored to your team and processes",
  "Client directory, contact details, notes & billing schedules",
  "Lead management, archives & sales pipeline",
  "Projects, budgets, costs & payment tracking",
  "Tasks, follow-ups, focus notes & calendar planning",
  "Payment ledger, statuses & upcoming-payment reminders",
  "Financial reports, exports & monthly history",
  "Income, expense & grocery tracking",
  "Stock & crypto portfolio tracking",
  "Currency preferences & conversion tools",
  "Team invitations & permission-based sharing",
  "Client imports & organized records",
  "Responsive access on mobile, tablet & desktop",
]

export default function PlansPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050812] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-12rem] top-[-8rem] h-[30rem] w-[30rem] rounded-full bg-cyan-400/[.08] blur-[110px]" />
        <div className="absolute right-[-12rem] top-[12rem] h-[34rem] w-[34rem] rounded-full bg-violet-500/[.10] blur-[120px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent" />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-6 sm:px-8 lg:px-10">
        <Link href="/" className="group flex items-center gap-3" aria-label="Orbit LM home">
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/[.07] text-cyan-200 shadow-[0_0_30px_rgba(34,211,238,.08)]">
            <Sparkles size={18} />
          </div>
          <div className="leading-tight">
            <div className="text-base font-semibold tracking-[-.02em] text-white">Orbit <span className="text-cyan-300">LM</span></div>
            <div className="text-[9px] font-semibold uppercase tracking-[.22em] text-slate-500">Life Management</div>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-xl border border-white/10 bg-white/[.035] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[.07] hover:text-white"
          >
            Sign in
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-7xl px-5 pb-8 pt-14 text-center sm:px-8 sm:pt-20 lg:px-10">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[.05] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.18em] text-cyan-200">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,.8)]" />
          Choose your next chapter
        </div>
        <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-semibold tracking-[-.045em] text-white sm:text-5xl lg:text-6xl">
          A plan for your <span className="bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-300 bg-clip-text text-transparent">kind of ambition.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
          Start with your life. Make room for your business. Keep the same Orbit as your world gets bigger.
        </p>

        <div className="mx-auto mt-8 flex max-w-2xl flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-2xl border border-white/[.08] bg-white/[.025] px-4 py-3 text-xs text-slate-400">
          <span className="inline-flex items-center gap-2 text-slate-300"><ShieldCheck size={14} className="text-cyan-300" /> Secure Stripe checkout</span>
          <span className="hidden text-slate-700 sm:inline">•</span>
          <span>Subscriptions shown in USD</span>
          <span className="hidden text-slate-700 sm:inline">•</span>
          <span>Taxes and final currency shown at checkout</span>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-5 pb-10 sm:px-8 lg:px-10">
        <div className="grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => {
            const Icon = plan.icon
            return (
              <article
                key={plan.key}
                className={`relative flex min-h-full flex-col overflow-hidden rounded-[28px] border p-5 shadow-[0_22px_70px_rgba(0,0,0,.28)] sm:p-6 ${
                  plan.featured
                    ? "border-cyan-300/30 bg-gradient-to-b from-cyan-300/[.09] via-[#0a1423] to-[#07101c] lg:-translate-y-3"
                    : "border-white/[.08] bg-[#08111e]"
                }`}
              >
                {plan.featured && (
                  <div className="absolute right-4 top-4 rounded-full border border-cyan-200/20 bg-cyan-300 px-3 py-1 text-[9px] font-bold uppercase tracking-[.16em] text-slate-950">
                    Room to grow
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[.04] text-cyan-200">
                    <Icon size={18} />
                  </div>
                  <span className="text-[9px] font-semibold uppercase tracking-[.17em] text-slate-500">{plan.index}</span>
                </div>

                <h2 className="mt-6 text-2xl font-semibold tracking-[-.03em] text-white">{plan.name}</h2>
                <p className="mt-2 min-h-[52px] text-sm leading-6 text-slate-400">{plan.description}</p>

                <div className="mt-6 border-y border-white/[.07] py-5">
                  <div className="text-xs text-slate-500">Was <span className="line-through">{plan.was}</span> <span>{plan.suffix}</span></div>
                  <div className="mt-1 flex items-end gap-2">
                    <span className="pb-1 text-[10px] font-semibold uppercase tracking-[.16em] text-cyan-300">Now</span>
                    <strong className="text-4xl font-semibold tracking-[-.045em] text-white">{plan.price}</strong>
                    <span className="pb-1 text-xs text-slate-500">{plan.suffix}</span>
                  </div>
                </div>

                <Link
                  href={`/subscribe?plan=${plan.key}`}
                  className={`mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${
                    plan.featured
                      ? "bg-cyan-300 text-slate-950 hover:bg-cyan-200"
                      : "border border-white/10 bg-white/[.04] text-white hover:bg-white/[.08]"
                  }`}
                >
                  Choose this plan <ArrowRight size={15} />
                </Link>

                <div className="mt-6 flex-1">
                  <h3 className="text-xs font-semibold uppercase tracking-[.12em] text-slate-300">{plan.heading}</h3>
                  <ul className="mt-4 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-400">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-cyan-300/15 bg-cyan-300/[.06] text-cyan-200"><Check size={12} /></span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="mt-6 border-t border-white/[.07] pt-4 text-xs leading-5 text-slate-500">{plan.foot}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-5 pb-16 pt-4 sm:px-8 lg:px-10 lg:pb-24">
        <article className="relative overflow-hidden rounded-[32px] border border-violet-300/20 bg-gradient-to-br from-violet-400/[.10] via-[#0a1322] to-cyan-300/[.045] p-5 shadow-[0_24px_90px_rgba(0,0,0,.3)] sm:p-7 lg:p-9">
          <div className="pointer-events-none absolute right-[-6rem] top-[-6rem] h-72 w-72 rounded-full bg-violet-400/[.10] blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[.82fr_1.18fr] lg:gap-12">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-300/[.07] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[.17em] text-violet-200">
                <Sparkles size={12} /> 04 / Built around your business
              </div>
              <h2 className="mt-5 text-3xl font-semibold tracking-[-.04em] text-white sm:text-4xl">Business Customization</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
                Your brand. Your processes. One connected workspace designed around the way your business works.
              </p>

              <div className="mt-7 rounded-2xl border border-white/[.08] bg-black/[.12] p-5">
                <div className="text-xs text-slate-500">Was <span className="line-through">$1,199.99</span></div>
                <div className="mt-1 flex flex-wrap items-end gap-2">
                  <span className="pb-1 text-[10px] font-semibold uppercase tracking-[.16em] text-violet-200">Now</span>
                  <strong className="text-4xl font-semibold tracking-[-.045em] text-white">$599.99</strong>
                  <span className="pb-1 text-xs text-slate-500">one-time</span>
                </div>
              </div>

              <Link
                href="/subscribe?plan=business_customization"
                className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-300 to-cyan-300 px-5 text-sm font-semibold text-slate-950 transition hover:brightness-110 sm:w-auto"
              >
                Purchase customization <ArrowRight size={15} />
              </Link>

              <p className="mt-4 text-xs leading-5 text-slate-500">
                Built on the Big Business toolkit. Customization scope, integrations, and support coverage are agreed before purchase. Third-party services depend on availability.
              </p>
            </div>

            <div className="rounded-[24px] border border-white/[.08] bg-[#08121f]/80 p-5 sm:p-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><BriefcaseBusiness size={17} className="text-violet-200" /> The Orbit toolkit, shaped around your business</h3>
              <div className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {customizationFeatures.map((feature) => (
                  <div key={feature} className="flex items-start gap-2.5 text-sm leading-5 text-slate-400">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-violet-300/15 bg-violet-300/[.06] text-violet-200"><Check size={12} /></span>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="relative z-10 border-t border-white/[.06] bg-white/[.015]">
        <div className="mx-auto max-w-7xl px-5 py-10 text-center sm:px-8 lg:px-10">
          <p className="mx-auto max-w-3xl text-xs leading-6 text-slate-500">
            Base prices are shown in USD. Subscription access activates after successful payment confirmation. Final taxes and available currency are shown during secure checkout. Investment tools are for tracking only and do not place trades.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-sm">
            <Link href="/login" className="text-cyan-300 hover:text-cyan-200">Already have access? Sign in <ArrowRight className="ml-1 inline" size={14} /></Link>
            <span className="text-slate-700">•</span>
            <Link href="/" className="text-slate-400 hover:text-white">Back to Orbit</Link>
          </div>
        </div>
      </section>
    </main>
  )
}
