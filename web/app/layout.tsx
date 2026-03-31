import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SKDL — Movie & Series Downloads',
  description: 'Get instant download links for movies and TV series via the SKDL Telegram bot.',
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
