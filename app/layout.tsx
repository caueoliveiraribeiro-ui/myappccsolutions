
import Script from "next/script"
import type React from "react"
import type { Metadata } from "next"
import { Figtree } from "next/font/google"
import "./globals.css"
import "./mobile.css"
import "./orbit-polish.css"
import "./dashboard-refinements.css"
import { OrbitThemeProvider } from "@/components/orbit-theme"
import { Toaster } from "@/components/ui/sonner"
import { OrbitSupportChat } from "@/components/orbit-support-chat"
import { LeadsManagerGoogleOnly } from "@/components/leads-manager-google-only"
import { LeadDirectoryEmailControls } from "@/components/lead-directory-email-controls"
import { CrmEmailActions } from "@/components/crm-email-actions"
import { OrbitUserProfile } from "@/components/orbit-user-profile"
import { OrbitProfilePreferenceSync } from "@/components/orbit-profile-preference-sync"
import { OrbitImprovementPrompt } from "@/components/orbit-improvement-prompt"
import { OrbitArchiveControls } from "@/components/orbit-archive-controls"
import { LoginPasswordVisibility } from "@/components/login-password-visibility"

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
    <html lang="en" suppressHydrationWarning className={`${figtree.variable} antialiased`}>
      <body className="font-sans">
        <OrbitThemeProvider>
          {children}

          <OrbitSupportChat />
          <LeadsManagerGoogleOnly />
          <LeadDirectoryEmailControls />
          <CrmEmailActions />
          <OrbitUserProfile />
          <OrbitProfilePreferenceSync />
          <OrbitImprovementPrompt />
          <OrbitArchiveControls />
          <LoginPasswordVisibility />
          <Toaster richColors />
        </OrbitThemeProvider>

        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-E8H9G63P8V"
          strategy="afterInteractive"
        />

        <Script id="google-analytics" strategy="afterInteractive">
          {`
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());

      gtag('config', 'G-YOUR_REAL_ID');
    `}
        </Script>
      </body>
    </html>
  )
}

