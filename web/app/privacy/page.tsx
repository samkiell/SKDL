import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy — SKDL',
  description: 'Privacy Policy for SKDL media delivery service.',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-black text-white pt-10 md:pt-16 pb-16 px-4 md:px-8 font-sans selection:bg-white/20">
      <div className="max-w-3xl mx-auto space-y-12">
        <header className="space-y-4">
          <Link href="/" className="text-zinc-500 hover:text-[#e8ff47] transition-colors text-xs font-mono tracking-widest uppercase">
            &larr; Return Home
          </Link>
          <h1 className="text-4xl md:text-6xl font-space font-bold tracking-tighter uppercase">
            Privacy Policy
          </h1>
          <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest">
            Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </header>

        <section className="space-y-8 text-zinc-400 text-sm md:text-base leading-relaxed font-mono">
          <div className="space-y-4">
            <h2 className="text-white text-xl font-space uppercase tracking-tight">01. Data Collection</h2>
            <p>
              SKDL is designed to be as private as possible. We only collect the bare minimum data required to deliver your media: 
              your Telegram User ID (to manage your download session) and the titles of the media you request.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-white text-xl font-space uppercase tracking-tight">02. Media Handling</h2>
            <p>
              We do not store your requested media permanently. Download links are generated on-the-fly and expire automatically 
              after 6 hours. After expiration, the links are invalidated from our database.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-white text-xl font-space uppercase tracking-tight">03. Cookies & Tracking</h2>
            <p>
              This website does not use tracking cookies or third-party analytics. We believe in a clean, fast experience 
              without surveillance.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-white text-xl font-space uppercase tracking-tight">04. Third Parties</h2>
            <p>
              Your requested titles are processed by Groq AI to understand your intent. No personal identification 
              is shared with the AI providers beyond the text of your request.
            </p>
          </div>
        </section>

        <footer className="pt-12 border-t border-white/10 text-zinc-600 text-[10px] uppercase font-mono tracking-[0.2em] text-center">
          SKDL // samkiel.online
        </footer>
      </div>
    </main>
  )
}
