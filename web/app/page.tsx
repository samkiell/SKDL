"use client"

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import styles from './landing.module.css'

export default function LandingPage() {
  const cursorDotRef = useRef<HTMLDivElement>(null)
  const cursorRingRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Custom Cursor Logic
    const cursorDot = cursorDotRef.current
    const cursorRing = cursorRingRef.current
    
    if (!cursorDot || !cursorRing) return

    let mouseX = 0
    let mouseY = 0
    let ringX = 0
    let ringY = 0

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY
      
      // Update dot position instantly
      cursorDot.style.left = `${mouseX}px`
      cursorDot.style.top = `${mouseY}px`
    }

    const animateRing = () => {
      // Interpolate ring position for lagging effect
      ringX += (mouseX - ringX) * 0.15
      ringY += (mouseY - ringY) * 0.15
      
      cursorRing.style.left = `${ringX}px`
      cursorRing.style.top = `${ringY}px`
      
      requestAnimationFrame(animateRing)
    }

    // Scroll Reveal Logic
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.15
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add(styles.visible)
        }
      })
    }, observerOptions)

    const revealElements = document.querySelectorAll(`.${styles.reveal}`)
    revealElements.forEach(el => observer.observe(el))

    // Interactive elements hover for cursor
    const interactiveElements = document.querySelectorAll('a, button')
    const addHover = () => document.body.classList.add(styles.cursorHover)
    const removeHover = () => document.body.classList.remove(styles.cursorHover)

    interactiveElements.forEach(el => {
      el.addEventListener('mouseenter', addHover)
      el.addEventListener('mouseleave', removeHover)
    })

    // Initialization
    window.addEventListener('mousemove', onMouseMove)
    const animFrame = requestAnimationFrame(animateRing)

    // Cleanup
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      cancelAnimationFrame(animFrame)
      revealElements.forEach(el => observer.unobserve(el))
      interactiveElements.forEach(el => {
        el.removeEventListener('mouseenter', addHover)
        el.removeEventListener('mouseleave', removeHover)
      })
    }
  }, [])

  const tickerItems = [
    "UNLIMITED MOVIES", "•", "HD SERIES", "•", "FAST DOWNLOADS", "•", "PREMIUM EXPERIENCE", "•",
  ]

  // Duplicate for seamless infinite scroll
  const allTickerItems = [...tickerItems, ...tickerItems, ...tickerItems, ...tickerItems]

  return (
    <div className={styles.page}>
      <div ref={cursorDotRef} className={styles.cursorDot}></div>
      <div ref={cursorRingRef} className={styles.cursorRing}></div>

      <nav className={styles.nav}>
        <Link href="/" className={styles.logo}>
          SKDL<span>.</span>
        </Link>
        <div>
          <a href="https://t.me/SK_DLBOT" target="_blank" rel="noopener noreferrer" className={styles.navLink}>
            Open Telegram
          </a>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroGlow}></div>
        <div className={`${styles.heroContent} ${styles.reveal}`}>
          <span className={styles.heroLabel}>CINEMATIC STREAMING & DOWNLOADS</span>
          <h1 className={styles.heroTitle}>Your Personal<br />Cinema Hub</h1>
          <p className={styles.heroDesc}>
            Experience lightning-fast movie and series downloads directly from Telegram. 
            No ads. No interruptions. Pure entertainment.
          </p>
          <a href="https://t.me/SK_DLBOT" target="_blank" rel="noopener noreferrer" className={`${styles.btn} ${styles.btnAccent}`}>
            START @SK_DLBOT
          </a>
        </div>
      </section>

      <div className={styles.tickerWrap}>
        <div className={styles.ticker}>
          {allTickerItems.map((item, i) => (
            <span key={i} className={item === "•" ? styles.tickerIcon : styles.tickerItem}>
              {item}
            </span>
          ))}
        </div>
      </div>

      <section className={styles.features}>
        <div className={styles.featuresGrid}>
          <div className={`${styles.featureCard} ${styles.reveal}`}>
            <div className={styles.featureIcon}>01</div>
            <h3 className={styles.featureTitle}>Instant Access</h3>
            <p className={styles.featureDesc}>
              Search for any movie or series and get download links within milliseconds. Integrated deep-search across multiple indexes.
            </p>
          </div>
          <div className={`${styles.featureCard} ${styles.reveal}`}>
            <div className={styles.featureIcon}>02</div>
            <h3 className={styles.featureTitle}>HD Quality</h3>
            <p className={styles.featureDesc}>
              Choose from multiple resolutions, from 720p up to pristine 4K. Download the right file size for your device.
            </p>
          </div>
          <div className={`${styles.featureCard} ${styles.reveal}`}>
            <div className={styles.featureIcon}>03</div>
            <h3 className={styles.featureTitle}>Ad-Free UI</h3>
            <p className={styles.featureDesc}>
              Say goodbye to pop-ups and fake download buttons. Direct server links straight to your device.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.hero} style={{ height: '60vh' }}>
        <div className={`${styles.heroContent} ${styles.reveal}`}>
          <h2 className={styles.heroTitle} style={{ fontSize: 'clamp(3rem, 8vw, 6rem)' }}>Ready to Watch?</h2>
          <p className={styles.heroDesc}>Join thousands of users who have upgraded their entertainment setup.</p>
          <a href="https://t.me/SK_DLBOT" target="_blank" rel="noopener noreferrer" className={styles.btn}>
            OPEN IN TELEGRAM
          </a>
        </div>
      </section>

      <footer className={styles.footer}>
        <div>&copy; {new Date().getFullYear()} SKDL. All rights reserved.</div>
        <div style={{ display: 'flex', gap: '2rem' }}>
          <a href="https://github.com/samkiell/SKDL" target="_blank" rel="noopener noreferrer" className={styles.navLink}>
            SOURCE
          </a>
          <a href="https://samkiel.online" target="_blank" rel="noopener noreferrer" className={styles.navLink}>
            SAMKIEL.ONLINE
          </a>
        </div>
      </footer>
    </div>
  )
}
