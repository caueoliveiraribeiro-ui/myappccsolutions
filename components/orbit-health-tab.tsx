"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { Activity, HeartPulse } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type Result = {
  bmr: number
  maintenance: number
  target: number | null
  label: string
}

const activityOptions = [
  { value: 1.2, label: "Sedentary · little or no exercise" },
  { value: 1.375, label: "Lightly active · 1–3 days/week" },
  { value: 1.55, label: "Moderately active · 3–5 days/week" },
  { value: 1.725, label: "Very active · 6–7 days/week" },
  { value: 1.9, label: "Extra active · hard training / physical job" },
]

const goalOptions = [
  { value: "maintain", label: "Maintain weight", adjustment: 0 },
  { value: "slow_loss", label: "Gradual weight loss · about 10% deficit", adjustment: -0.1 },
  { value: "moderate_loss", label: "Moderate weight loss · about 15% deficit", adjustment: -0.15 },
  { value: "gain", label: "Gradual weight gain · about 10% surplus", adjustment: 0.1 },
]

export function OrbitHealthTab() {
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: number | null = null

    const bind = () => {
      if (cancelled) return
      const nav = document.querySelector("#orbit-navigation nav") as HTMLElement | null
      const section = document.querySelector("main.wealth-dashboard section.min-w-0.flex-1") as HTMLElement | null
      if (!nav || !section) {
        timer = window.setTimeout(bind, 150)
        return
      }
      setTarget(section)

      let healthButton = nav.querySelector("[data-orbit-health-nav]") as HTMLButtonElement | null
      if (!healthButton) {
        const expensesButton = Array.from(nav.querySelectorAll("button")).find((button) =>
          (button.getAttribute("aria-label") || button.textContent || "").trim() === "Expenses",
        ) as HTMLButtonElement | undefined

        if (!expensesButton) {
          timer = window.setTimeout(bind, 150)
          return
        }

        healthButton = document.createElement("button")
        healthButton.type = "button"
        healthButton.dataset.orbitHealthNav = "true"
        healthButton.setAttribute("aria-label", "Health")
        healthButton.setAttribute("title", "Health")
        healthButton.className = "relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
        healthButton.innerHTML = '<span class="relative z-10 flex items-center gap-3"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.7-1.5 2.1 5 1.4-3H21"/></svg><span class="nav-label">Health</span></span>'
        expensesButton.insertAdjacentElement("afterend", healthButton)
        healthButton.addEventListener("click", () => setOpen(true))
      }
    }

    bind()

    const onNavigationClick = (event: Event) => {
      const clicked = (event.target as HTMLElement | null)?.closest("#orbit-navigation button") as HTMLButtonElement | null
      if (clicked && !clicked.matches("[data-orbit-health-nav]")) setOpen(false)
    }
    document.addEventListener("click", onNavigationClick, true)

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
      document.removeEventListener("click", onNavigationClick, true)
      document.querySelector("[data-orbit-health-nav]")?.remove()
    }
  }, [])

  useEffect(() => {
    if (!target) return
    const healthButton = document.querySelector("[data-orbit-health-nav]") as HTMLButtonElement | null
    if (healthButton) {
      healthButton.setAttribute("aria-current", open ? "page" : "false")
      healthButton.className = open
        ? "relative flex w-full items-center gap-3 rounded-xl bg-cyan-300 px-3 py-2 text-sm text-slate-950 shadow-[0_0_18px_#3b82f655] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
        : "relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
    }

    const children = Array.from(target.children) as HTMLElement[]
    children.forEach((child) => {
      if (child.matches("[data-orbit-health-page]")) return
      if (open) {
        if (!child.dataset.orbitHealthDisplay) child.dataset.orbitHealthDisplay = child.style.display || "__empty__"
        child.style.display = "none"
      } else if (child.dataset.orbitHealthDisplay) {
        child.style.display = child.dataset.orbitHealthDisplay === "__empty__" ? "" : child.dataset.orbitHealthDisplay
        delete child.dataset.orbitHealthDisplay
      }
    })

    return () => {
      Array.from(target.children).forEach((node) => {
        const child = node as HTMLElement
        if (!child.dataset.orbitHealthDisplay) return
        child.style.display = child.dataset.orbitHealthDisplay === "__empty__" ? "" : child.dataset.orbitHealthDisplay
        delete child.dataset.orbitHealthDisplay
      })
    }
  }, [open, target])

  if (!open || !target) return null
  return createPortal(<HealthPage />, target)
}

function HealthPage() {
  const [sex, setSex] = useState("male")
  const [age, setAge] = useState("30")
  const [height, setHeight] = useState("175")
  const [weight, setWeight] = useState("75")
  const [activity, setActivity] = useState("1.55")
  const [goal, setGoal] = useState("maintain")
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState("")

  const selectedGoal = useMemo(() => goalOptions.find((item) => item.value === goal) || goalOptions[0], [goal])

  function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

    const years = Number(age)
    const cm = Number(height)
    const kg = Number(weight)
    const multiplier = Number(activity)

    if (!Number.isFinite(years) || years < 18 || years > 100) return setError("This calculator is designed for adults ages 18–100.")
    if (!Number.isFinite(cm) || cm < 120 || cm > 230) return setError("Enter a height between 120 and 230 cm.")
    if (!Number.isFinite(kg) || kg < 35 || kg > 300) return setError("Enter a weight between 35 and 300 kg.")
    if (!Number.isFinite(multiplier)) return setError("Choose an activity level.")

    const bmr = 10 * kg + 6.25 * cm - 5 * years + (sex === "male" ? 5 : -161)
    const maintenance = bmr * multiplier
    const calculatedTarget = maintenance * (1 + selectedGoal.adjustment)
    const targetCalories = calculatedTarget < 1200 ? null : calculatedTarget

    setResult({
      bmr: Math.round(bmr),
      maintenance: Math.round(maintenance),
      target: targetCalories === null ? null : Math.round(targetCalories),
      label: selectedGoal.label,
    })
  }

  return (
    <div data-orbit-health-page className="min-w-0 space-y-4 text-white">
      <header className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200"><HeartPulse size={20} /></div>
          <div>
            <h1 className="text-xl font-semibold">Health</h1>
            <p className="text-xs text-slate-500">Personal wellness tools inside your Orbit.</p>
          </div>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <Card className="border-white/10 bg-white/5 p-5 text-white">
          <div>
            <div className="flex items-center gap-2"><Activity size={18} className="text-cyan-200" /><h2 className="font-semibold">Daily calorie calculator</h2></div>
            <p className="mt-2 text-sm leading-6 text-slate-400">Estimate your basal metabolic rate (BMR), maintenance calories and a conservative daily calorie target using the Mifflin–St Jeor equation.</p>
          </div>

          <form onSubmit={calculate} className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-slate-400">Sex used by the equation
              <select value={sex} onChange={(event) => setSex(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-white/10 bg-[#111827] px-3 text-sm text-white">
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </label>
            <label className="text-xs text-slate-400">Age
              <Input value={age} onChange={(event) => setAge(event.target.value)} type="number" min="18" max="100" inputMode="numeric" className="mt-1" />
            </label>
            <label className="text-xs text-slate-400">Height (cm)
              <Input value={height} onChange={(event) => setHeight(event.target.value)} type="number" min="120" max="230" step="0.1" inputMode="decimal" className="mt-1" />
            </label>
            <label className="text-xs text-slate-400">Weight (kg)
              <Input value={weight} onChange={(event) => setWeight(event.target.value)} type="number" min="35" max="300" step="0.1" inputMode="decimal" className="mt-1" />
            </label>
            <label className="text-xs text-slate-400 sm:col-span-2">Activity level
              <select value={activity} onChange={(event) => setActivity(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-white/10 bg-[#111827] px-3 text-sm text-white">
                {activityOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-400 sm:col-span-2">Goal
              <select value={goal} onChange={(event) => setGoal(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-white/10 bg-[#111827] px-3 text-sm text-white">
                {goalOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            {error && <p role="alert" className="sm:col-span-2 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
            <Button type="submit" className="sm:col-span-2 bg-cyan-300 text-slate-950">Calculate daily calories</Button>
          </form>
        </Card>

        <div className="space-y-4">
          <Card className="border-white/10 bg-white/5 p-5 text-white">
            <h2 className="font-semibold">Your estimate</h2>
            {!result ? (
              <p className="text-sm leading-6 text-slate-400">Enter your details and calculate to see your estimated energy needs.</p>
            ) : (
              <div className="space-y-3">
                <ResultRow label="BMR" value={`${result.bmr.toLocaleString()} kcal/day`} sub="Estimated energy used at rest" />
                <ResultRow label="Maintenance" value={`${result.maintenance.toLocaleString()} kcal/day`} sub="Estimated daily energy expenditure" />
                {result.target === null ? (
                  <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm leading-5 text-amber-100">The calculated goal would be unusually low. Orbit will not recommend that target; consider speaking with a qualified clinician or dietitian.</div>
                ) : (
                  <ResultRow label="Goal target" value={`${result.target.toLocaleString()} kcal/day`} sub={result.label} emphasis />
                )}
              </div>
            )}
          </Card>

          <Card className="border-cyan-300/15 bg-cyan-300/[.05] p-5 text-white">
            <h3 className="font-semibold text-cyan-100">About this estimate</h3>
            <p className="text-sm leading-6 text-slate-400">This tool provides an estimate, not a diagnosis or medical prescription. Actual energy needs can differ. It is intended for adults and is not designed for pregnancy, minors, eating-disorder treatment, or medical conditions that affect nutrition or metabolism.</p>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ResultRow({ label, value, sub, emphasis = false }: { label: string; value: string; sub: string; emphasis?: boolean }) {
  return (
    <div className={emphasis ? "rounded-xl border border-cyan-300/30 bg-cyan-300/10 p-4" : "rounded-xl border border-white/10 bg-black/20 p-4"}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <b className={emphasis ? "mt-1 block text-2xl text-cyan-100" : "mt-1 block text-xl text-white"}>{value}</b>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  )
}
