"use client"

import { ThemeProvider, useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"

export function OrbitThemeProvider({ children }: { children: React.ReactNode }) {
  return <ThemeProvider attribute="data-orbit-theme" storageKey="orbit-theme-v1" defaultTheme="dark" enableSystem={false} enableColorScheme={false} disableTransitionOnChange>{children}</ThemeProvider>
}

export function OrbitThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  const light = ready && theme === "light"
  return <button type="button" className="orbit-theme-toggle" disabled={!ready} aria-label={light ? "Switch to dark theme" : "Switch to light theme"} title={light ? "Dark theme" : "Light theme"} aria-pressed={light} onClick={() => setTheme(light ? "dark" : "light")}>
    {light ? <Moon size={20} aria-hidden="true"/> : <Sun size={20} aria-hidden="true"/>}
  </button>
}
