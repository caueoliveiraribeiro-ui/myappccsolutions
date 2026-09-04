import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Orbit LM — A little more life. A lot more clarity.",
  description:
    "Bring your business, money and everyday life into one thoughtfully connected workspace. Discover Orbit LM for independent people and growing businesses.",
  alternates: { canonical: "https://orbit-lm.com/plans" },
}

export default function PlansPage() {
  return (
    <main style={{ margin: 0, width: "100%", height: "100dvh", overflow: "hidden", background: "#080b13" }}>
      <iframe
        src="/orbit-plans.html"
        title="Orbit LM plans and product overview"
        style={{ display: "block", width: "100%", height: "100%", border: 0, background: "#080b13" }}
      />
    </main>
  )
}
