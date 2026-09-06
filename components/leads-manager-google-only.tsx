"use client"

import { useEffect } from "react"

const STYLE_ID = "orbit-google-only-leads-style"

export function LeadsManagerGoogleOnly() {
  useEffect(() => {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style")
      style.id = STYLE_ID
      style.textContent = `
        [data-orbit-google-only-leads="true"] [data-orbit-lead-source-tabs="true"] > button:not(:first-child) {
          display: none !important;
        }
        [data-orbit-google-only-leads="true"] [data-orbit-hospitality-note="true"] {
          display: none !important;
        }
      `
      document.head.appendChild(style)
    }

    function cleanLeadsFinder() {
      const headings = Array.from(document.querySelectorAll("h2"))
      const heading = headings.find((node) => node.textContent?.trim() === "Find and manage leads")
      const panel = heading?.parentElement as HTMLElement | null
      if (!panel || !heading) return

      panel.dataset.orbitGoogleOnlyLeads = "true"

      const content = heading.nextElementSibling as HTMLElement | null
      const sourceTabs = content?.firstElementChild as HTMLElement | null
      if (sourceTabs) sourceTabs.dataset.orbitLeadSourceTabs = "true"

      panel.querySelectorAll("p").forEach((paragraph) => {
        const text = paragraph.textContent || ""
        if (text.includes("Hospitality means") || text.includes("Airbnb research")) {
          ;(paragraph as HTMLElement).dataset.orbitHospitalityNote = "true"
        }
      })

      panel.querySelectorAll("button").forEach((button) => {
        const label = button.textContent?.trim() || ""
        if (label === "Airbnb / Hospitality" || label === "Manual" || label === "Open Airbnb") {
          ;(button as HTMLElement).style.setProperty("display", "none", "important")
        }
      })
    }

    cleanLeadsFinder()
    const observer = new MutationObserver(cleanLeadsFinder)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    const timer = window.setInterval(cleanLeadsFinder, 1000)
    return () => {
      observer.disconnect()
      window.clearInterval(timer)
    }
  }, [])

  return null
}
