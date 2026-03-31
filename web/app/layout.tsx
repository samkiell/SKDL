import type { Metadata } from 'next'
import './globals.css'

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
      <body className="antialiased bg-[#0f0f0f] text-white">
        {children}
      </body>
    </html>
  )
}
