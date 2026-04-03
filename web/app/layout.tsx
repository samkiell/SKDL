import type { Metadata } from 'next'
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
  description: 'Instant AI-Powered TV & Movie Downloads.',
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

        <footer className="w-full border-t border-white/10 bg-black py-8 mt-auto">
          <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center text-xs font-mono text-zinc-600 space-y-4 md:space-y-0">
            <div>&copy; {new Date().getFullYear()} SKDL AI.</div>
            <div className="flex gap-4">
              <a href="https://samkiel.online" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">SAMKIEL.ONLINE</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
