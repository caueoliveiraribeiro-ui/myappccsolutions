"use client"

import { useEffect, useRef, useState } from "react"
import { Menu, Sparkles, X } from "lucide-react"
import * as Dialog from "@radix-ui/react-dialog"

export function MobileNavigation({ open, onOpenChange }: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [publicOpen, setPublicOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const dashboard = Boolean(onOpenChange)

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)")
    const resize = () => { if (media.matches) { setPublicOpen(false); onOpenChange?.(false) } }
    media.addEventListener("change", resize)
    return () => media.removeEventListener("change", resize)
  }, [onOpenChange])

  useEffect(() => {
    if (!open || !dashboard) return
    const sidebar = document.getElementById("orbit-navigation")
    if (!sidebar) return
    const content = sidebar.nextElementSibling as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    const previousInert = content?.inert ?? false
    document.body.style.overflow = "hidden"
    if (content) content.inert = true
    sidebar.setAttribute("role", "dialog")
    sidebar.setAttribute("aria-modal", "true")
    sidebar.setAttribute("aria-label", "Dashboard navigation")
    const focusable = () => Array.from(sidebar.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]')).filter(el => el.getClientRects().length > 0)
    focusable()[0]?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onOpenChange?.(false) }
      if (event.key !== "Tab") return
      const items = focusable(), first = items[0], last = items[items.length - 1]
      if (!first) { event.preventDefault(); return }
      if (event.shiftKey && (document.activeElement === first || !sidebar.contains(document.activeElement))) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !sidebar.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    }
    document.addEventListener("keydown", keydown)
    return () => {
      document.body.style.overflow = previousOverflow
      if (content) content.inert = previousInert
      sidebar.removeAttribute("role"); sidebar.removeAttribute("aria-modal"); sidebar.removeAttribute("aria-label")
      document.removeEventListener("keydown", keydown)
      trigger.current?.focus()
    }
  }, [open, dashboard, onOpenChange])

  const brand = <span className="orbit-mobile-brand"><Sparkles aria-hidden="true" /><span>Orbit LM<small>Life Management</small></span></span>
  if (dashboard) return <>
    <header className="orbit-mobile-header"><span>{brand}</span><button ref={trigger} type="button" aria-label="Open navigation" aria-controls="orbit-navigation" aria-expanded={open} onClick={() => onOpenChange?.(true)}><Menu aria-hidden="true" /></button></header>
    {open && <div className="orbit-mobile-backdrop" aria-hidden="true" onClick={() => onOpenChange?.(false)} />}
  </>
  return <Dialog.Root open={publicOpen} onOpenChange={setPublicOpen}>
    <header className="orbit-mobile-header"><a href="#access" aria-label="Orbit LM sign in">{brand}</a><Dialog.Trigger asChild><button type="button" aria-label="Open navigation"><Menu aria-hidden="true" /></button></Dialog.Trigger></header>
    <Dialog.Portal><Dialog.Overlay className="orbit-public-menu-overlay" /><Dialog.Content className="orbit-public-menu">
      <Dialog.Title>Explore Orbit LM</Dialog.Title><Dialog.Description>Choose where you want to go.</Dialog.Description>
      <Dialog.Close className="orbit-menu-close" aria-label="Close navigation"><X aria-hidden="true" /></Dialog.Close>
      <nav aria-label="Main navigation">{[["#access", "Sign in or create an account"], ["/plans", "Explore plans"], ["/privacy-policy", "Privacy Policy"], ["/terms-of-service", "Terms of Service"]].map(([href, label]) => <Dialog.Close key={href} asChild><a href={href}>{label}</a></Dialog.Close>)}</nav>
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>
}
