'use client'

import { 
  BarChart3, 
  Users, 
  Zap, 
  MessageSquare,
  AlertTriangle
} from 'lucide-react'

export default function BotActivityPage() {
  const sections = [
    { title: 'Dynamic Request Logs', description: 'Real-time feed of incoming bot commands and natural language processing results.', icon: MessageSquare },
    { title: 'User Analytics', description: 'Monitoring of unique Telegram user interactions and growth metrics.', icon: Users },
    { title: 'Hot Content Matrix', description: 'Aggregation of the most requested movies and series for inventory optimization.', icon: Zap },
  ]

  return (
    <div className="space-y-12 max-w-6xl">
      <header className="space-y-6 border-b border-white/5 pb-10">
        <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-zinc-900/50 border border-white/10">
          <AlertTriangle className="w-4 h-4 text-zinc-500" />
          <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-[0.2em]">Module Activation Pending</span>
        </div>
        <div className="space-y-3">
          <h1 className="text-5xl font-space font-bold tracking-tighter text-white uppercase">Bot Engine Terminal</h1>
          <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-[0.4em] font-bold">Signal Interpretation & Processing Intelligence</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sections.map((section) => (
          <div key={section.title} className="p-10 rounded-xl bg-white/[0.02] border border-white/10 space-y-8 relative overflow-hidden group hover:bg-white/[0.04] transition-all duration-500">
            <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-5 transition-opacity duration-700 transform group-hover:scale-150 group-hover:rotate-12 translate-x-4 -translate-y-4">
               <section.icon className="w-40 h-40 text-white" />
            </div>
            
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:bg-white/5 group-hover:border-white/10">
              <section.icon className="w-8 h-8 text-zinc-600 transition-colors group-hover:text-white" />
            </div>
            
            <div className="space-y-4 relative z-10">
              <h2 className="text-xl font-bold text-white tracking-tight uppercase font-space">{section.title}</h2>
              <p className="text-xs text-zinc-600 leading-relaxed font-mono uppercase tracking-[0.1em] group-hover:text-zinc-400 transition-colors">{section.description}</p>
            </div>

            <div className="pt-6">
               <div className="inline-flex items-center gap-3 text-[9px] font-mono font-bold text-zinc-800 bg-black/40 px-5 py-2.5 rounded-xl border border-white/5 uppercase tracking-widest transition-all group-hover:text-zinc-600 group-hover:border-white/10">
                 BUFFERING STREAM <div className="w-1.5 h-1.5 rounded-full bg-zinc-900 group-hover:bg-white/20 animate-pulse" />
               </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-16 rounded-xl bg-[#080808] border border-dashed border-white/10 flex flex-col items-center justify-center text-center space-y-8 group hover:border-white/20 transition-all duration-700">
         <div className="relative">
            <div className="w-24 h-24 rounded-[2rem] bg-zinc-900/50 flex items-center justify-center group-hover:scale-110 transition-all duration-500">
               <BarChart3 className="w-12 h-12 text-zinc-800 animate-pulse group-hover:text-white/50" />
            </div>
            <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#080808] border border-white/10 flex items-center justify-center">
               <div className="w-2 h-2 rounded-full bg-zinc-800 animate-pulse" />
            </div>
         </div>
         <div className="space-y-4">
            <h3 className="text-2xl font-bold text-zinc-500 font-space uppercase tracking-tighter">Engine Telemetry Pending</h3>
            <p className="text-[10px] text-zinc-700 max-w-sm mx-auto font-mono uppercase tracking-[0.3em] leading-loose font-bold">
              This module is scheduled for activation in Phase 2. Integration with Supabase Bot Logs is required for live monitoring.
            </p>
         </div>
         <button className="px-10 py-5 bg-[#0a0a0a] border border-white/5 rounded-2xl text-[10px] font-mono font-bold text-zinc-800 uppercase tracking-[0.4em] hover:text-white hover:border-white/20 transition-all hover:bg-white/5 active:scale-95 shadow-xl">
            Check Integration Logic
         </button>
      </div>

      {/* TODO: wire up bot logging to Supabase to populate this page */}
    </div>
  )
}
