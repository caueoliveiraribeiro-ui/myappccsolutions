import type { ReactNode } from "react"
import Link from "next/link"

export function LegalPage({ title, intro, sections }: {
  title: string
  intro: string
  sections: { title: string; content: ReactNode }[]
}) {
  return <main className="min-h-screen bg-[#080b13] px-5 py-10 text-slate-200 sm:px-8 sm:py-16">
    <div className="mx-auto max-w-4xl">
      <nav aria-label="Legal page navigation" className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="text-xl font-semibold text-cyan-200">Orbit LM</Link>
        <Link href="/plans" className="rounded-xl border border-cyan-300/30 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-300/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">Back to plans</Link>
      </nav>
      <article className="overflow-hidden rounded-3xl border border-cyan-300/25 bg-gradient-to-br from-[#10232f] via-[#0c1422] to-[#181529] shadow-[0_0_45px_rgba(34,211,238,.08)]">
        <header className="border-b border-cyan-300/20 p-6 sm:p-10">
          <p className="mb-3 text-xs uppercase tracking-[.2em] text-cyan-200">Clarity &amp; trust</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">{title}</h1>
          <p className="mt-5 max-w-2xl leading-7 text-slate-300">{intro}</p>
          <p className="mt-5 text-sm text-slate-400">Last updated: September 8, 2026 · Orbit-LM</p>
        </header>
        <div className="space-y-9 p-6 sm:p-10">
          {sections.map((section, index) => <section key={section.title} aria-labelledby={`legal-section-${index}`}>
            <h2 id={`legal-section-${index}`} className="mb-3 text-lg font-semibold text-cyan-100">{index + 1}. {section.title}</h2>
            <div className="space-y-3 break-words text-sm leading-7 text-slate-300 [&_a]:text-cyan-200 [&_a]:underline [&_a]:underline-offset-4">{section.content}</div>
          </section>)}
        </div>
      </article>
      <footer className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3 pb-20 text-sm text-cyan-200">
        <Link href="/privacy-policy">Privacy Policy</Link>
        <Link href="/terms-of-service">Terms of Service</Link>
        <a href="mailto:tsblsestudio@gmail.com">Contact Orbit-LM</a>
      </footer>
    </div>
  </main>
}
