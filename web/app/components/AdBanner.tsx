'use client'

import { useEffect, useState } from 'react'

interface AdBannerProps {
  adKey: string;       // unique key per placement to avoid conflicts
  width?: number;
  height?: number;
}

interface AdSettings {
  ads_enabled: boolean;
  adsterra_banner_tag?: string;
  adsterra_banner_src?: string;
  adsterra_key?: string;
  adsterra_popunder?: string;
  adsterra_social_bar?: string;
}

// Simple global cache to avoid multiple components fetching the same settings repeatedly
let cachedSettings: AdSettings | null = null;
let isFetchingSettings = false;
const subscribers: ((settings: AdSettings) => void)[] = [];
let globalScriptsMounted = false;

function mountGlobalScripts(settings: AdSettings) {
  if (typeof window === 'undefined' || globalScriptsMounted || !settings.ads_enabled) return;
  globalScriptsMounted = true;

  // 1. Social Bar script
  const socialSrc = settings.adsterra_social_bar || process.env.NEXT_PUBLIC_ADSTERRA_SOCIAL_BAR_SRC;
  if (socialSrc && !document.getElementById('adsterra-social-bar')) {
    const script = document.createElement('script');
    script.id = 'adsterra-social-bar';
    script.src = socialSrc.match(/src="([^"]+)"/)?.[1] || socialSrc;
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    document.head.appendChild(script);
  }

  // 2. Popunder script
  const popunderCode = settings.adsterra_popunder || process.env.NEXT_PUBLIC_ADSTERRA_POPUNDER;
  if (popunderCode && !document.getElementById('adsterra-popunder-global')) {
    const srcMatch = popunderCode.match(/src="([^"]+)"/);
    if (srcMatch) {
      const script = document.createElement('script');
      script.id = 'adsterra-popunder-global';
      script.src = srcMatch[1];
      script.async = true;
      script.setAttribute('data-cfasync', 'false');
      document.head.appendChild(script);
    } else if (popunderCode.startsWith('http')) {
      const script = document.createElement('script');
      script.id = 'adsterra-popunder-global';
      script.src = popunderCode;
      script.async = true;
      script.setAttribute('data-cfasync', 'false');
      document.head.appendChild(script);
    } else {
      const script = document.createElement('script');
      script.id = 'adsterra-popunder-global';
      script.type = 'text/javascript';
      script.innerHTML = popunderCode.replace(/<script[^>]*>/gi, '').replace(/<\/script>/gi, '');
      document.head.appendChild(script);
    }
  }
}

function resolveBannerContent(
  settings: AdSettings,
  width: number,
  height: number
): string | null {
  // 1. Check if a banner tag is explicitly provided
  const tag = settings.adsterra_banner_tag || process.env.NEXT_PUBLIC_ADSTERRA_BANNER_TAG;
  if (tag && tag.trim().length > 0) {
    return tag.trim();
  }

  // 2. Check if an Adsterra key is provided
  const key = settings.adsterra_key || process.env.NEXT_PUBLIC_ADSTERRA_BANNER_KEY;
  if (key && key.trim().length > 0) {
    const cleanKey = key.trim();
    return `
      <script type="text/javascript">
        atOptions = {
          'key' : '${cleanKey}',
          'format' : 'iframe',
          'height' : ${height},
          'width' : ${width},
          'params' : {}
        };
      </script>
      <script type="text/javascript" src="//www.highperformanceformat.com/${cleanKey}/invoke.js"></script>
    `;
  }

  // 3. Check banner src
  const src = settings.adsterra_banner_src || process.env.NEXT_PUBLIC_ADSTERRA_BANNER_SRC;
  if (src && src.trim().length > 0) {
    const trimmed = src.trim();
    // Popunder scripts do not generate visible banner elements — do not render empty boards for them
    if (trimmed.includes('millionairelucidlytransmitted.com')) {
      return null;
    }
    const hexKeyMatch = trimmed.match(/([a-f0-9]{32})/i);
    if (hexKeyMatch) {
      const extractedKey = hexKeyMatch[1];
      return `
        <script type="text/javascript">
          atOptions = {
            'key' : '${extractedKey}',
            'format' : 'iframe',
            'height' : ${height},
            'width' : ${width},
            'params' : {}
          };
        </script>
        <script type="text/javascript" src="${trimmed}"></script>
      `;
    }
    return `<script type="text/javascript" src="${trimmed}" data-cfasync="false" async></script>`;
  }

  return null;
}

export default function AdBanner({ adKey, width = 300, height = 250 }: AdBannerProps) {
  const [settings, setSettings] = useState<AdSettings | null>(cachedSettings)

  useEffect(() => {
    if (cachedSettings) {
      setSettings(cachedSettings);
      mountGlobalScripts(cachedSettings);
      return;
    }

    if (isFetchingSettings) {
      subscribers.push((s) => {
        setSettings(s);
        mountGlobalScripts(s);
      });
      return;
    }

    const fetchAdsStatus = async () => {
      isFetchingSettings = true;
      try {
        const res = await fetch('/api/lighthouse/settings')
        if (!res.ok) throw new Error('API failed')
        const data = await res.json()
        
        const envVal = (process.env.NEXT_PUBLIC_ADS || '').toUpperCase();
        const enabled = data.ads_enabled === 'true' || data.ads_enabled === 'ON' || data.ads_enabled === true || envVal === 'ON' || envVal === 'TRUE';
        
        const newSettings: AdSettings = {
          ads_enabled: enabled,
          adsterra_banner_tag: data.adsterra_banner_tag,
          adsterra_banner_src: data.adsterra_banner_src,
          adsterra_key: data.adsterra_key,
          adsterra_popunder: data.adsterra_popunder,
          adsterra_social_bar: data.adsterra_social_bar,
        };

        cachedSettings = newSettings;
        setSettings(newSettings);
        mountGlobalScripts(newSettings);

        subscribers.forEach(sub => sub(newSettings));
        subscribers.length = 0;
      } catch (e) {
        console.error('Failed to fetch ads settings:', e)
        const envVal = (process.env.NEXT_PUBLIC_ADS || '').toUpperCase();
        const fallback = envVal === 'ON' || envVal === 'TRUE';
        const fallbackSettings: AdSettings = { ads_enabled: fallback };
        cachedSettings = fallbackSettings;
        setSettings(fallbackSettings);
        mountGlobalScripts(fallbackSettings);

        subscribers.forEach(sub => sub(fallbackSettings));
        subscribers.length = 0;
      } finally {
        isFetchingSettings = false;
      }
    }

    fetchAdsStatus()
  }, [])

  if (!settings || !settings.ads_enabled) return null

  const bannerContent = resolveBannerContent(settings, width, height)
  // If no banner content is configured, do not render an empty ad board
  if (!bannerContent) return null

  const srcDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      display: flex;
      justify-content: center;
      align-items: center;
      background: transparent;
    }
  </style>
</head>
<body>
  ${bannerContent}
</body>
</html>`

  return (
    <div className="flex flex-col items-center gap-1 my-4">
      <div
        style={{
          width,
          height,
          minWidth: width,
          minHeight: height,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
        aria-hidden="true"
      >
        <iframe
          key={`${adKey}-${width}x${height}`}
          title={`ad-${adKey}`}
          srcDoc={srcDoc}
          width={width}
          height={height}
          scrolling="no"
          style={{
            border: 'none',
            width: `${width}px`,
            height: `${height}px`,
            overflow: 'hidden',
            display: 'block',
          }}
        />
      </div>
      <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
        Ad helps keep this site free
      </p>
    </div>
  )
}
