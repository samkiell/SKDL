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

// ─── METADATA ────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  // Core
  metadataBase: new URL('https://samkiel.online'),
  title: {
    default: 'SKDL — AI-Powered Movie & TV Show Downloads',
    template: '%s | SKDL',
  },
  description:
    'SKDL is your AI-powered media companion. Search, discover, and download any movie or TV show instantly — powered by the @SK_DLBOT Telegram bot.',
  keywords: [
    'movie downloader',
    'TV show download',
    'AI movie bot',
    'Telegram movie bot',
    'SK_DLBOT',
    'SKDL',
    'free movie download',
    'series download',
    'movie search',
    'instant media download',
    'HD movie download',
    '1080p movies',
    'watch movies online',
    'download TV shows',
  ],
  authors: [{ name: 'SAMKIEL', url: 'https://samkiel.dev' }],
  creator: 'SAMKIEL',
  publisher: 'SKDL',
  category: 'entertainment',

  // Canonical + robots
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // Open Graph — controls WhatsApp, Discord, Facebook previews
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://samkiel.online',
    siteName: 'SKDL',
    title: 'SKDL — AI-Powered Movie & TV Show Downloads',
    description:
      'Search and download any movie or TV show instantly. Powered by @SK_DLBOT on Telegram.',
    images: [
      {
        url: '/og-image.png',      // create a 1200x630 image and drop it in /public
        width: 1200,
        height: 630,
        alt: 'SKDL — AI-Powered Movie & TV Show Downloads',
        type: 'image/png',
      },
    ],
  },

  // Twitter / X card
  twitter: {
    card: 'summary_large_image',
    title: 'SKDL — AI-Powered Movie & TV Show Downloads',
    description:
      'Search and download any movie or TV show instantly. Powered by @SK_DLBOT on Telegram.',
    images: ['/og-image.png'],
    creator: '@samkiel',          // update to your actual Twitter handle if you have one
  },

  // Icons
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: [
      { url: '/SKDL.png', sizes: '180x180', type: 'image/png' },
    ],
  },

  // PWA manifest
  manifest: '/manifest.json',

  // Verification (add your tokens once you connect Search Console)
  verification: {
    google: 'YOUR_GOOGLE_SEARCH_CONSOLE_TOKEN',
  },
}

// ─── JSON-LD STRUCTURED DATA ─────────────────────────────────────────────────
// Tells Google exactly what this app is — enables rich results

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'SKDL',
  url: 'https://samkiel.online',
  description:
    'AI-powered movie and TV show discovery and download platform, powered by the @SK_DLBOT Telegram bot.',
  applicationCategory: 'EntertainmentApplication',
  operatingSystem: 'Web, Telegram',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  author: {
    '@type': 'Person',
    name: 'SAMKIEL',
    url: 'https://samkiel.dev',
  },
  creator: {
    '@type': 'Person',
    name: 'SAMKIEL',
    url: 'https://samkiel.dev',
  },
  sameAs: [
    'https://t.me/SK_DLBOT',
    'https://samkiel.dev',
  ],
}

// ─── LAYOUT ──────────────────────────────────────────────────────────────────

import ConditionalHeader from './components/ConditionalHeader'
import ConditionalFooter from './components/ConditionalFooter'
import GlobalNotice from './components/GlobalNotice'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`antialiased bg-black text-white ${inter.variable} ${spaceGrotesk.variable} ${jbMono.variable} flex flex-col min-h-screen`}
      >
        {/* JSON-LD injected into <head> at the edge — zero client JS cost */}
        <Script
          id="json-ld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          strategy="beforeInteractive"
        />

        <GlobalNotice />

        <ConditionalHeader>
          <header className="w-full border-b border-white/10 bg-black/80 backdrop-blur-md sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 md:py-4 flex items-center justify-between">
              <Link href="/" className="transition-transform active:scale-95">
                <img src="/SKDL.png" alt="SKDL Logo" className="h-7 md:h-9 w-auto object-contain" />
              </Link>
              <nav className="flex gap-6 items-center text-sm font-mono text-zinc-400">
                <Link href="/discover" className="hover:text-white transition-colors">DISCOVER</Link>
                <Link href="/sub" className="hover:text-white transition-colors">SUBTITLES</Link>
              </nav>
            </div>
          </header>
        </ConditionalHeader>

        <div className="flex-1">{children}</div>

        <ConditionalFooter>
          <footer className="w-full border-t border-white/5 bg-black py-12 mt-auto">
            <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-6">
              <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
                <Link href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy Policy</Link>
                <Link href="/terms" className="hover:text-zinc-400 transition-colors">Terms of Use</Link>
              </div>
              <div className="text-center text-[10px] font-mono text-zinc-700 uppercase tracking-widest">
                &copy; {new Date().getFullYear()} SKDL. Built by{' '}
                <a
                  href="https://samkiel.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors underline underline-offset-4 decoration-zinc-800"
                >
                  SAMKIEL
                </a>
                .<br />
                All rights reserved.
              </div>
            </div>
          </footer>

          {process.env.NEXT_PUBLIC_ADS === 'ON' && process.env.NEXT_PUBLIC_ADSTERRA_POPUNDER && (
            <Script
              id="adsterra-popunder"
              strategy="afterInteractive"
              src={process.env.NEXT_PUBLIC_ADSTERRA_POPUNDER.match(/src="([^"]+)"/)?.[1]}
              dangerouslySetInnerHTML={
                !process.env.NEXT_PUBLIC_ADSTERRA_POPUNDER.includes('src=')
                  ? {
                      __html: process.env.NEXT_PUBLIC_ADSTERRA_POPUNDER
                        .replace(/<script[^>]*>/, '')
                        .replace(/<\/script>/, ''),
                    }
                  : undefined
              }
            />
          )}
        </ConditionalFooter>
      </body>
    </html>
  )
}
