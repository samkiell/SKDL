import type { Metadata } from 'next'
import { Bebas_Neue, DM_Mono, Syne } from 'next/font/google'
import './globals.css'

const bebasNeue = Bebas_Neue({ 
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
})

const dmMono = DM_Mono({
  weight: ['300', '400'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-dm',
})

const syne = Syne({
  weight: ['400', '700', '800'],
  subsets: ['latin'],
  variable: '--font-syne',
})

export const metadata: Metadata = {
  title: 'SKDL — Netflix and Chill with SKDL',
  description: 'Instant movie and series downloads via SKDL.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`antialiased bg-[#0f0f0f] text-white ${bebasNeue.variable} ${dmMono.variable} ${syne.variable}`}>
        {children}
      </body>
    </html>
  )
}
