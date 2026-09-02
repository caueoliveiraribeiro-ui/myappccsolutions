import type React from "react"
import type { Metadata } from "next"
import { Figtree } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"

const figtree = Figtree({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-figtree",
})

export const metadata: Metadata = {
  title: "Orbit CRM — Global Growth OS",
  description: "Secure CRM for worldwide lead discovery, creative sales and investment tracking.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${figtree.variable} antialiased`}>
      <body className="font-sans">{children}<Toaster richColors theme="dark" /></body>
    </html>
  )
}

