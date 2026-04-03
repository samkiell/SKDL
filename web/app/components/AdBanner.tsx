'use client'

import { useEffect, useRef } from 'react'

export default function AdBanner() {
  const adRef = useRef<HTMLDivElement>(null)
  const adTag = process.env.NEXT_PUBLIC_ADSTERRA_BANNER_TAG
  const adsOn = process.env.NEXT_PUBLIC_ADS === 'ON'

  useEffect(() => {
    if (!adRef.current || !adTag || !adsOn) return

    // Clear previous content
    adRef.current.innerHTML = ''

    // Create a container and inject the script via ranges to ensure it executes
    const range = document.createRange()
    const fragment = range.createContextualFragment(adTag)
    adRef.current.appendChild(fragment)
  }, [adTag])

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
