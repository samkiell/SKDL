import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4 md:px-6 font-sans text-white">
      <div className="text-center w-full max-w-md border border-white/10 p-8 rounded-xl bg-[#0a0a0a]">
        <div className="text-3xl mb-4 text-zinc-500">🔗</div>
        <h1 className="text-xl font-medium mb-2">Not Found</h1>
        <p className="text-sm text-zinc-400 mb-8 font-mono">ERROR_404_LINK_UNAVAILABLE</p>
        <a
          href="https://t.me/SK_DLBOT"
          className="block w-full bg-white text-black text-sm font-bold px-6 py-3.5 rounded-md hover:bg-zinc-200 transition-colors uppercase tracking-wider"
        >
          Return to Telegram Bot
        </a>
      </div>
    </div>
  )
}
