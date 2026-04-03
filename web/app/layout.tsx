import type { Metadata } from 'next'
import Script from 'next/script'
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import Link from 'next/link'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space',
})

const jbMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'SKDL — Netflix and Chill with SKDL',
  description: 'Netflix and chill with SKDL — Instant AI-Powered TV & Movie Downloads.',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/SKDL.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`antialiased bg-black text-white ${inter.variable} ${spaceGrotesk.variable} ${jbMono.variable} flex flex-col min-h-screen`}>
        <header className="w-full border-b border-white/10 bg-black/80 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-5 flex items-center justify-between">
            <Link href="/" className="text-3xl font-space font-bold tracking-tighter text-white">
              SKDL
            </Link>
            <nav className="flex gap-6 items-center text-sm font-mono text-zinc-400">
              <span className="hidden md:block text-xs text-zinc-500">Netflix and chill with skdl</span>
              <Link href="/discover" className="hover:text-white transition-colors">DISCOVER</Link>
              <a href="https://t.me/SK_DLBOT" target="_blank" rel="noopener noreferrer" className="text-white hover:text-zinc-300 transition-colors uppercase tracking-widest font-bold">
                BOT
              </a>
            </nav>
          </div>
        </header>

        <div className="flex-1">
          {children}
        </div>

        <footer className="w-full border-t border-white/5 bg-black py-12 mt-auto">
          <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-6">
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
              <Link href="/privacy" className="hover:text-[#e8ff47] transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-[#e8ff47] transition-colors">Terms of Use</Link>
              <a href="https://t.me/SK_DLBOT" target="_blank" rel="noopener noreferrer" className="hover:text-[#e8ff47] transition-colors">Support Bot</a>
            </div>
            
            <div className="text-center text-[10px] font-mono text-zinc-700 uppercase tracking-widest">
              &copy; {new Date().getFullYear()} SKDL. Built by <a href="https://samkiel.dev" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors underline underline-offset-4 decoration-zinc-800">SAMKIEL</a>. 
              <br />
            All rights reserved.
            </div>
          </div>
        </footer>
        {process.env.NEXT_PUBLIC_ADSTERRA_SOCIAL_BAR_SRC && (
          <Script
            src={process.env.NEXT_PUBLIC_ADSTERRA_SOCIAL_BAR_SRC}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  )
}
