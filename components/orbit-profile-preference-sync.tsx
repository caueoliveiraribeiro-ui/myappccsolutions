"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

type ProfilePreferences = {
  country: string
  language: string
  currency: string
  market: string
}

function preferences(profile: Record<string, any>): ProfilePreferences {
  return {
    country: String(profile.country || "US").toUpperCase(),
    language: String(profile.language || "en").toLowerCase(),
    currency: String(profile.currency || "USD").toUpperCase(),
    market: String(profile.preferred_market || profile.country || "US").toUpperCase(),
  }
}

function signature(value: ProfilePreferences) {
  return [value.country, value.language, value.currency, value.market].join("|")
}

function applyDocumentPreferences(value: ProfilePreferences) {
  document.documentElement.lang = value.language || "en"
  document.documentElement.dataset.orbitCountry = value.country
  document.documentElement.dataset.orbitCurrency = value.currency
  document.documentElement.dataset.orbitMarket = value.market
}

export function OrbitProfilePreferenceSync() {
  const current = useRef("")
  const checking = useRef(false)

  useEffect(() => {
    let active = true

    if (sessionStorage.getItem("orbit-profile-preferences-applied") === "1") {
      sessionStorage.removeItem("orbit-profile-preferences-applied")
      window.setTimeout(() => toast.success("Profile preferences applied across Orbit."), 50)
    }

    async function sync() {
      if (!active || checking.current) return
      checking.current = true
      try {
        const response = await fetch("/api/me", { cache: "no-store" })
        if (!response.ok) return
        const profile = await response.json()
        const next = preferences(profile)
        const nextSignature = signature(next)
        applyDocumentPreferences(next)

        if (!current.current) {
          current.current = nextSignature
          return
        }

        if (current.current !== nextSignature) {
          current.current = nextSignature
          sessionStorage.setItem("orbit-profile-preferences-applied", "1")
          // Regional preferences affect FX conversion, market selection,
          // translations and date/time presentation throughout the client app.
          // A single controlled reload guarantees every mounted dashboard view
          // is recreated from the newly persisted /api/me profile.
          window.location.reload()
        }
      } catch {
        // The regular dashboard refresh path remains available if this check fails.
      } finally {
        checking.current = false
      }
    }

    void sync()
    const onFocus = () => void sync()
    const onProfileUpdate = () => void sync()
    window.addEventListener("focus", onFocus)
    window.addEventListener("orbit:profile-updated", onProfileUpdate)

    return () => {
      active = false
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("orbit:profile-updated", onProfileUpdate)
    }
  }, [])

  return null
}

