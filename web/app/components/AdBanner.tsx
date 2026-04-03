'use client'

import { useEffect, useRef, useState } from 'react'

export default function AdBanner() {
  const adRef = useRef<HTMLDivElement>(null)
  const adTag = process.env.NEXT_PUBLIC_ADSTERRA_BANNER_TAG
  const [adsEnabled, setAdsEnabled] = useState(process.env.NEXT_PUBLIC_ADS === 'ON')

  useEffect(() => {
    const fetchAdsStatus = async () => {
      try {
        const res = await fetch('/api/lighthouse/settings')
        const data = await res.json()
        if (data.ads_enabled !== undefined) {
          setAdsEnabled(data.ads_enabled === 'true')
        }
      } catch (e) {
        console.error('Failed to fetch ads settings:', e)
      }
    }
    fetchAdsStatus()
  }, [])

  useEffect(() => {
    if (!adRef.current || !adTag || !adsEnabled) return

    // Clear previous content
    adRef.current.innerHTML = ''

    // Create a container and inject the script via ranges to ensure it executes
    const range = document.createRange()
    const fragment = range.createContextualFragment(adTag)
    adRef.current.appendChild(fragment)
  }, [adTag, adsEnabled])

  if (!adTag) return null

  return (
    <div className="flex flex-col items-center gap-1 my-1">
      <div 
        ref={adRef} 
        className="ad-wrapper flex justify-center w-full min-h-[20px] md:min-h-[150px] overflow-hidden" 
        aria-hidden="true" 
      />
      <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
        Ad helps keep this site free
      </p>
    </div>
  )
}
