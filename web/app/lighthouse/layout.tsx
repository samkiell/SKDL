'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  LayoutDashboard, 
  Link2, 
  BarChart3, 
  Lock, 
  Menu,
  X,
  Zap,
  Settings
} from 'lucide-react'
import { Toaster, toast } from 'sonner'
import { useState } from 'react'
import { logout } from './login/actions'

export default function LighthouseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Don't show sidebar on login page
  if (pathname === '/lighthouse/login') {
    return <>{children}</>
  }

  const navItems = [
    { name: 'Dashboard', href: '/lighthouse', icon: LayoutDashboard },
    { name: 'Links Management', href: '/lighthouse/links', icon: Link2 },
    { name: 'Bot Engine', href: '/lighthouse/bot', icon: BarChart3 },
    { name: 'Configure', href: '/lighthouse/settings', icon: Settings },
  ]

  const handleLogout = async () => {
    await logout()
    router.push('/lighthouse/login')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen bg-[#050505] text-zinc-400 font-sans selection:bg-white/10 overflow-hidden">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 border-b border-white/5 bg-black/80 backdrop-blur-md z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <span className="font-space font-bold tracking-tighter text-white text-xl">
            SKDL<span className="text-yellow-400">.</span>
          </span>
          <span className="font-space font-extrabold tracking-tighter text-white text-lg opacity-40">LIGHTHOUSE</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-white">
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-[#080808] border-r border-white/5 transform transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] lg:translate-x-0 lg:static
        ${isMobileMenuOpen ? 'translate-x-0 shadow-[20px_0_50px_rgba(0,0,0,0.5)]' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          <div className="p-8 pb-12">
            <Link href="/lighthouse" className="flex items-center gap-3 px-2 group">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center transition-all duration-300 group-hover:bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.02)]">
                <span className="font-space font-bold tracking-tighter text-white text-sm">
                  S<span className="text-yellow-400">.</span>
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-space font-bold tracking-tighter text-white text-xl uppercase leading-none">Lighthouse</span>
                <span className="text-[10px] font-mono text-zinc-600 tracking-[0.2em] font-bold uppercase mt-1">Admin Terminal</span>
              </div>
            </Link>
          </div>

          <nav className="flex-1 px-4 space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`
                    flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 relative group
                    ${isActive 
                      ? 'bg-white/5 text-white border border-white/10' 
                      : 'hover:bg-white/[0.02] hover:text-zinc-200 border border-transparent'}
                  `}
                >
                  <item.icon className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-white' : 'text-zinc-600 group-hover:text-zinc-300'}`} />
                  <span className={`text-[11px] font-bold tracking-[0.1em] uppercase ${isActive ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`}>{item.name}</span>
                  {isActive && (
                    <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                  )}
                </Link>
              )
            })}
          </nav>

          <div className="p-8 border-t border-white/5 bg-black/20">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-4 px-4 py-3.5 rounded-2xl w-full hover:bg-zinc-900 group transition-all duration-300 border border-transparent hover:border-white/5"
            >
              <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center group-hover:bg-white/5 group-hover:text-white transition-colors">
                <Lock className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
              </div>
              <span className="text-[11px] font-bold tracking-[0.1em] uppercase text-zinc-600 group-hover:text-zinc-400">Lock Terminal</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:pl-0 pt-16 lg:pt-0 overflow-y-auto custom-scrollbar">
        <div className="min-h-screen">
          <div className="max-w-7xl mx-auto p-6 md:p-10 lg:p-16">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-30 lg:hidden animate-in fade-in duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #222;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #333;
        }
      `}</style>
      <Toaster 
        theme="dark" 
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'rgba(8, 8, 8, 0.8)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            color: '#fff',
            fontFamily: 'var(--font-sans)',
          },
        }}
      />
    </div>
  )
}
