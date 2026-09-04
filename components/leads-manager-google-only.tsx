"use client"

import { useEffect } from "react"

/**
 * Keeps the existing Leads Management implementation intact while presenting
 * only the Google lead finder in the Find and manage leads panel.
 *
 * This is deliberately scoped by the panel heading text so it does not touch
 * Manual/Add controls elsewhere in Orbit.
 */
export function LeadsManagerGoogleOnly() {
  useEffect(() => {
    function cleanLeadsFinder() {
      const headings = Array.from(document.querySelectorAll("h2"))
      const heading = headings.find((node) => node.textContent?.trim() === "Find and manage leads")
      const panel = heading?.parentElement
      if (!panel) return

      panel.querySelectorAll("button").forEach((button) => {
        const label = button.textContent?.trim() || ""
        if (label === "Airbnb / Hospitality" || label === "Manual" || label === "Open Airbnb") {
          button.remove()
        }
      })

      panel.querySelectorAll("p").forEach((paragraph) => {
        const text = paragraph.textContent || ""
        if (text.includes("Hospitality means") || text.includes("Airbnb research")) {
          paragraph.remove()
        }
      })
    }

    cleanLeadsFinder()
    const observer = new MutationObserver(cleanLeadsFinder)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return null
}
