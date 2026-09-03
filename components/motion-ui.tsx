"use client"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Card } from "@/components/ui/card"

type R = Record<string, any>

// A weighted "settle" — motion that reads as something arriving into orbit
// rather than a generic ease-out. Reused everywhere so every animated
// moment in the app feels like the same hand drew it.
export const orbitEase = [0.16, 1, 0.3, 1] as const

/**
 * Wraps a page's content. Plays a single settle-in on mount, so switching
 * pages in the sidebar reads as one deliberate transition instead of every
 * card inside re-animating independently.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion()
  if (reduce) return <>{children}</>
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.985, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.45, ease: orbitEase }}
    >
      {children}
    </motion.div>
  )
}

/**
 * Sidebar nav button. The active background is a single element that slides
 * between items (layoutId) instead of each button toggling its own
 * background — one continuous piece of motion, not N independent ones.
 */
export function NavItem({ active, icon: Icon, label, onClick }: R) {
  const reduce = useReducedMotion()
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={
        "relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 " +
        (active ? "text-slate-950" : "text-slate-400 hover:bg-white/5")
      }
    >
      {active && (
        <motion.span
          layoutId="nav-active-pill"
          className="absolute inset-0 rounded-xl bg-cyan-300 shadow-[0_0_18px_#3b82f655]"
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40, mass: 0.6 }}
        />
      )}
      <span className="relative z-10 flex items-center gap-3">
        <Icon size={16} />
        {label}
      </span>
    </button>
  )
}

/**
 * Unified metric card (replaces the four near-identical copies that were
 * scattered across investments-v2 / operations-dashboard / crm-dashboard /
 * overview-v3). Accepts both `I` and `icon` so every existing call site
 * keeps working unchanged.
 *
 * The value doesn't count up digit-by-digit — since it's already a
 * formatted currency/percentage string, we instead treat a value change as
 * a small, deliberate "flip": the old value drops away, the new one rises
 * in. Motion that answers something that actually changed (a purchase
 * recorded, a price refreshed), not decoration on every render.
 */
export function Metric({ title, value, sub, icon, I, babyBlue = false, neonOrange = false }: R) {
  const Icon = icon || I
  const reduce = useReducedMotion()
  return (
    <Card className={"metric-card relative overflow-hidden p-5 "+(neonOrange?"metric-card--orange border-orange-400 bg-gradient-to-br from-[#351506] to-[#1c100b] text-orange-100 shadow-[0_0_22px_#ff7a003b,inset_0_0_18px_#ff7a0012]":babyBlue?"metric-card--blue border-sky-200 bg-gradient-to-br from-[#a8dcff] to-[#65bfff] text-[#082f49] shadow-[0_0_24px_#7dd3fc40]":"border-white/10 bg-white/5 text-white")}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2">
        <div className="contents">
          <p className={neonOrange?"text-sm font-semibold text-orange-300":babyBlue?"text-sm font-semibold text-[#0c4a6e]":"text-sm text-slate-400"}>{title}</p>
          <div className="col-span-2 mt-1 min-w-0 overflow-hidden">
            {reduce ? (
              <b className="block break-words text-2xl tabular-nums">{value}</b>
            ) : (
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.b
                  key={String(value)}
                  initial={{ y: 16, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -16, opacity: 0 }}
                  transition={{ duration: 0.32, ease: orbitEase }}
                  className="block break-words text-2xl tabular-nums"
                >
                  {value}
                </motion.b>
              </AnimatePresence>
            )}
          </div>
          {sub && <span className={neonOrange?"col-span-2 text-xs text-orange-200":babyBlue?"col-span-2 text-xs text-[#0c4a6e]":"col-span-2 text-xs text-cyan-300"}>{sub}</span>}
        </div>
        {Icon && (
          <motion.div
            whileHover={reduce ? undefined : { rotate: 6, scale: 1.08 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
            className={neonOrange?"col-start-2 row-start-1 shrink-0 rounded-xl bg-orange-400/15 p-2 text-orange-400":babyBlue?"col-start-2 row-start-1 shrink-0 rounded-xl bg-white/35 p-2 text-[#075985]":"col-start-2 row-start-1 shrink-0 rounded-xl bg-cyan-300/10 p-2 text-cyan-300"}
          >
            <Icon size={18} />
          </motion.div>
        )}
      </div>
    </Card>
  )
}

