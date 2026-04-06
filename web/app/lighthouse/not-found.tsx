import Link from 'next/link'
import { FileQuestion } from 'lucide-react'

export default function LighthouseNotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
        <FileQuestion className="w-8 h-8 text-zinc-600" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-space font-bold tracking-tighter text-white uppercase">Terminal Error 404</h1>
        <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-[0.3em]">Requested administrative module not found</p>
      </div>
      <Link 
        href="/lighthouse" 
        className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-mono font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
      >
        Return to Command Center
      </Link>
    </div>
  )
}
