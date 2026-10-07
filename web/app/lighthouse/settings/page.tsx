'use client'

import { useState, useEffect } from 'react'
import { 
  Settings, 
  Save, 
  RotateCcw, 
  ShieldCheck, 
  Layout, 
  Megaphone,
  Bot
} from 'lucide-react'
import { toast } from 'sonner'

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/lighthouse/settings')
      const data = await res.json()
      setSettings(data)
    } catch (error) {
      toast.error('FAILED_TO_LOAD_CONFIG')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const updateSetting = async (key: string, value: any) => {
    setSaving(key)
    try {
      const res = await fetch('/api/lighthouse/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      })
      if (res.ok) {
        setSettings((prev: any) => ({ ...prev, [key]: value }))
        toast.success(`SYSTEM_KEY_${key.toUpperCase()}_UPDATED`)
      } else {
        throw new Error('Update failed')
      }
    } catch (error) {
      toast.error('UPDATE_SEQUENCE_FAILED')
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 rounded-full border-t-2 border-white animate-spin" />
        <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-[0.3em] font-bold">Accessing System Partition...</p>
      </div>
    )
  }

  return (
    <div className="space-y-12 max-w-4xl">
      <header className="flex flex-col gap-4 border-b border-white/5 pb-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-space font-bold tracking-tighter text-white uppercase">System Config</h1>
            <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-[0.4em] font-bold">Global Parameter Management & Overrides</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8">
        
        {/* Monetization Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
             <Megaphone className="w-4 h-4 text-zinc-600" />
             <h2 className="text-[11px] font-bold uppercase tracking-[0.3em] text-zinc-500">Monetization Engine</h2>
          </div>
          
          <div className="p-8 rounded-xl bg-white/[0.02] border border-white/5 space-y-8">
            <div className="flex items-center justify-between group">
               <div className="space-y-1">
                 <p className="text-sm font-bold text-white tracking-tight">Ads System Policy</p>
                 <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">Toggle all Adsterra scripts and banners</p>
               </div>
               <button 
                 onClick={() => updateSetting('ads_enabled', settings.ads_enabled === 'true' ? 'false' : 'true')}
                 disabled={saving === 'ads_enabled'}
                 className={`relative w-14 h-7 rounded-full transition-all duration-500 ${settings.ads_enabled === 'true' ? 'bg-white' : 'bg-zinc-900 border border-white/10'}`}
               >
                 <div className={`absolute top-1 w-5 h-5 rounded-full transition-all duration-500 ${settings.ads_enabled === 'true' ? 'left-8 bg-black' : 'left-1 bg-zinc-700'}`} />
               </button>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
               <div className="flex items-center justify-between">
                 <p className="text-sm font-bold text-white tracking-tight">Banner Ad Tag</p>
                 {saving === 'adsterra_banner_tag' && <span className="text-[8px] font-mono text-white animate-pulse uppercase">Saving...</span>}
               </div>
               <textarea
                 rows={3}
                 placeholder="Paste Adsterra banner HTML tag or invoke script..."
                 defaultValue={settings.adsterra_banner_tag || ''}
                 onBlur={(e) => updateSetting('adsterra_banner_tag', e.target.value)}
                 className="w-full bg-black/50 border border-white/5 rounded-xl px-6 py-4 text-xs font-mono text-zinc-400 focus:outline-none focus:border-white/20 transition-all resize-y"
               />
               <p className="text-[9px] font-mono text-zinc-700 uppercase tracking-widest">HTML / Script snippet for 728x90 and 300x250 placements</p>
            </div>

            <div className="space-y-4">
               <div className="flex items-center justify-between">
                 <p className="text-sm font-bold text-white tracking-tight">Social Bar Script URL</p>
                 {saving === 'adsterra_social_bar' && <span className="text-[8px] font-mono text-white animate-pulse uppercase">Saving...</span>}
               </div>
               <input
                 type="text"
                 placeholder="E.g. https://pl29046630.profitablecpmratenetwork.com/.../invoke.js"
                 defaultValue={settings.adsterra_social_bar || ''}
                 onBlur={(e) => updateSetting('adsterra_social_bar', e.target.value)}
                 className="w-full bg-black/50 border border-white/5 rounded-xl px-6 py-4 text-xs font-mono text-zinc-400 focus:outline-none focus:border-white/20 transition-all"
               />
               <p className="text-[9px] font-mono text-zinc-700 uppercase tracking-widest">Floating social push notification ad script</p>
            </div>

            <div className="space-y-4">
               <div className="flex items-center justify-between">
                 <p className="text-sm font-bold text-white tracking-tight">Popunder Script Code / URL</p>
                 {saving === 'adsterra_popunder' && <span className="text-[8px] font-mono text-white animate-pulse uppercase">Saving...</span>}
               </div>
               <input
                 type="text"
                 placeholder="E.g. <script src='https://...'></script> or direct script URL"
                 defaultValue={settings.adsterra_popunder || ''}
                 onBlur={(e) => updateSetting('adsterra_popunder', e.target.value)}
                 className="w-full bg-black/50 border border-white/5 rounded-xl px-6 py-4 text-xs font-mono text-zinc-400 focus:outline-none focus:border-white/20 transition-all"
               />
               <p className="text-[9px] font-mono text-zinc-700 uppercase tracking-widest">Background popunder ad trigger</p>
            </div>
          </div>
        </section>

        {/* Branding Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
             <Layout className="w-4 h-4 text-zinc-600" />
             <h2 className="text-[11px] font-bold uppercase tracking-[0.3em] text-zinc-500">Branding & Identity</h2>
          </div>
          
          <div className="p-8 rounded-xl bg-white/[0.02] border border-white/5 space-y-8">
            <div className="space-y-4">
               <div className="flex items-center justify-between">
                 <p className="text-sm font-bold text-white tracking-tight">Universal Tagline</p>
                 {saving === 'app_tagline' && <span className="text-[8px] font-mono text-white animate-pulse uppercase">Saving...</span>}
               </div>
               <input 
                 type="text" 
                 defaultValue={settings.app_tagline || 'Netflix and chill with skdl'}
                 onBlur={(e) => updateSetting('app_tagline', e.target.value)}
                 className="w-full bg-black/50 border border-white/5 rounded-xl px-6 py-4 text-xs font-mono text-zinc-400 focus:outline-none focus:border-white/20 transition-all"
               />
               <p className="text-[9px] font-mono text-zinc-700 uppercase tracking-widest">Displayed on player and download pages</p>
            </div>

            <div className="space-y-4">
               <div className="flex items-center justify-between">
                 <p className="text-sm font-bold text-white tracking-tight">System Notice</p>
                 {saving === 'app_notice' && <span className="text-[8px] font-mono text-white animate-pulse uppercase">Saving...</span>}
               </div>
               <input 
                 type="text" 
                 placeholder="E.g. Server maintenance scheduled for 04/05..."
                 defaultValue={settings.app_notice || ''}
                 onBlur={(e) => updateSetting('app_notice', e.target.value)}
                 className="w-full bg-black/50 border border-white/5 rounded-xl px-6 py-4 text-xs font-mono text-zinc-400 focus:outline-none focus:border-white/20 transition-all"
               />
               <p className="text-[9px] font-mono text-zinc-700 uppercase tracking-widest">Optional banner shown across the platform</p>
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
             <ShieldCheck className="w-4 h-4 text-zinc-600" />
             <h2 className="text-[11px] font-bold uppercase tracking-[0.3em] text-zinc-500">Access Protocols</h2>
          </div>
          
          <div className="p-8 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col items-center justify-center py-20 text-center gap-4">
             <Lock className="w-8 h-8 text-zinc-800" />
             <div className="space-y-1">
                <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest">Advanced Security</p>
                <p className="text-[10px] font-mono text-zinc-800 uppercase tracking-widest italic">Lighthouse PIN management is restricted to environment variables</p>
             </div>
          </div>
        </section>

      </div>

      <footer className="pt-10 border-t border-white/5 flex items-center justify-between">
         <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            <span className="text-[10px] font-mono font-bold text-zinc-600 uppercase tracking-widest">Configuration Stable</span>
         </div>
         <button 
           onClick={fetchSettings}
           className="flex items-center gap-2 text-[10px] font-mono font-bold text-zinc-700 hover:text-white transition-colors uppercase tracking-widest"
         >
           <RotateCcw className="w-3.5 h-3.5" /> REFRESH_PARTITION
         </button>
      </footer>
    </div>
  )
}

function Lock(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}
