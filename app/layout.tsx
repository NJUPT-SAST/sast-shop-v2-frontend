// NOTE: The Tauri production CSP is set in src-tauri/tauri.conf.json.
// If you call an external API from the browser, add its origin to the
// `connect-src` directive there, otherwise the request will be blocked.
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { ClientProviders } from "./providers"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "React HeroUI Quick Starter",
  description: "Next.js 16 + Tauri 2 + HeroUI v3 starter",
}

// Tauri uses `output: "export"`, so we cannot read request headers
// at the layout level. Default the locale here; switch via a client
// hook if you add a language toggle later.
const DEFAULT_LOCALE = "zh-CN"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang={DEFAULT_LOCALE} suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ClientProviders lang={DEFAULT_LOCALE}>{children}</ClientProviders>
      </body>
    </html>
  )
}
