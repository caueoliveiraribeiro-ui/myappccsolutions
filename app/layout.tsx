import type React from "react"
import type { Metadata } from "next"
import { Figtree } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { OrbitSupportChat } from "@/components/orbit-support-chat"
import { LeadsManagerGoogleOnly } from "@/components/leads-manager-google-only"

const figtree = Figtree({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-figtree",
})

export const metadata: Metadata = {
  title: "Orbit LM — Life Management",
  description: "A secure operating system for clients, work, money, investments and everyday life.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${figtree.variable} antialiased`}>
      <body className="font-sans">
        {children}
        <OrbitSupportChat />
        <LeadsManagerGoogleOnly />
        <Toaster richColors theme="dark" />
      </body>
    </html>
  )
}
