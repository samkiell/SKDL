import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-4xl mb-4">🔗</div>
        <h1 className="text-xl font-semibold text-white mb-2">Link not found.</h1>
        <p className="text-gray-400 mb-6">
          This link doesn&apos;t exist or has been removed.
        </p>
        <a
          href="https://t.me/SK_DLBOT"
          className="inline-block bg-white text-black font-medium px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Go to bot
        </a>
      </div>
    </div>
  )
}
