'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ChevronIcon } from '@/components/icons'

// Banners are CSS gradients composed with catalog images, so the hero needs no campaign artwork.
const TONES = {
  teal: 'bg-linear-to-r from-[#0b3b44] via-[#12707a] to-[#37b5a8] text-white',
  violet: 'bg-linear-to-r from-[#161a45] via-[#3a2d7d] to-[#8a6ad6] text-white',
  peach: 'bg-linear-to-r from-[#ffe2b8] via-[#ffc680] to-[#ff9b57] text-ink',
  rose: 'bg-linear-to-r from-[#fde3ea] via-[#f7b7ca] to-[#e584a6] text-ink',
}

export type Slide = { kicker: string; title: string; blurb: string; cta: string; href: string; images: string[]; tone: keyof typeof TONES }

const REDUCED = '(prefers-reduced-motion: reduce)'
const subscribe = (onChange: () => void) => {
  const mq = matchMedia(REDUCED)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
const IMAGE_VISIBILITY = ['flex', 'hidden sm:flex', 'hidden md:flex']

// Amazon's home "herotator": auto-advances, pauses on hover and keyboard focus, has a pause button and dots,
// swipes on touch, and does not auto-play for people who prefer reduced motion.
export function Hero({ slides }: { slides: Slide[] }) {
  const n = slides.length
  const [index, setIndex] = useState(0)
  const [choice, setChoice] = useState<boolean | null>(null) // the pause/play button beats the motion preference
  const [held, setHeld] = useState(false)
  const reduced = useSyncExternalStore(subscribe, () => matchMedia(REDUCED).matches, () => false)
  const playing = choice ?? !reduced
  const touchX = useRef(0)

  useEffect(() => {
    if (!playing || held || n < 2) return
    const t = setTimeout(() => setIndex((i) => (i + 1) % n), 6000)
    return () => clearTimeout(t)
  }, [index, playing, held, n])

  if (!n) return null
  const go = (i: number) => setIndex((i + n) % n)
  const arrow = 'pointer-events-auto absolute inset-y-0 flex w-11 cursor-pointer items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white sm:w-16'

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured"
      className="relative overflow-hidden"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={(e) => {
        if (e.target.matches(':focus-visible')) setHeld(true)
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHeld(false)
      }}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX
      }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - touchX.current
        if (Math.abs(dx) > 40) go(index - Math.sign(dx))
      }}
    >
      <div className="flex motion-safe:transition-transform motion-safe:duration-700" style={{ transform: `translateX(-${index * 100}%)` }} aria-live={playing && !held ? 'off' : 'polite'}>
        {slides.map((s, i) => (
          <div key={s.href} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${n}: ${s.kicker}`} inert={i !== index} className={`h-[220px] w-full shrink-0 sm:h-[280px] lg:h-[600px] ${TONES[s.tone]}`}>
            <Link href={s.href} className="mx-auto flex h-full max-w-[1500px] items-center gap-4 px-12 focus-visible:outline-3 focus-visible:-outline-offset-8 focus-visible:outline-white sm:px-20 lg:h-[270px] lg:px-24">
              <span className="block min-w-0 max-w-lg">
                <span className="block text-xs font-bold tracking-wide uppercase opacity-85 sm:text-sm">{s.kicker}</span>
                <span className="mt-1 block text-[22px] leading-tight font-bold sm:text-4xl lg:text-[42px]">{s.title}</span>
                <span className="mt-2 hidden text-base sm:block lg:text-lg">{s.blurb}</span>
                <span className="mt-3 inline-block rounded-full bg-cart px-4 py-1.5 text-sm font-bold text-ink shadow sm:mt-4 sm:px-5 sm:py-2">{s.cta}</span>
              </span>
              <span className="ml-auto flex shrink-0 items-center gap-3 lg:gap-5">
                {s.images.slice(0, 3).map((src, k) => (
                  <span key={src} className={`${IMAGE_VISIBILITY[k]} size-24 items-center justify-center rounded-2xl bg-white p-2 shadow-lg sm:size-36 lg:size-48 ${k === 1 ? 'lg:-translate-y-4' : ''}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="max-h-full max-w-full object-contain" />
                  </span>
                ))}
              </span>
            </Link>
          </div>
        ))}
      </div>

      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-[350px] bg-linear-to-b from-transparent to-page lg:block" />

      {n > 1 && (
        <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-[220px] max-w-[1500px] sm:h-[280px] lg:h-[270px]">
          <button type="button" onClick={() => go(index - 1)} aria-label="Previous slide" className={`${arrow} left-0`}>
            <span className="rounded-full bg-white/85 p-1 text-ink shadow"><ChevronIcon className="size-6 rotate-180" /></span>
          </button>
          <button type="button" onClick={() => go(index + 1)} aria-label="Next slide" className={`${arrow} right-0`}>
            <span className="rounded-full bg-white/85 p-1 text-ink shadow"><ChevronIcon className="size-6" /></span>
          </button>
          <div className="pointer-events-auto absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center rounded-full bg-black/45 px-1">
            {slides.map((s, i) => (
              <button key={s.href} type="button" onClick={() => go(i)} aria-label={`Show slide ${i + 1} of ${n}`} aria-current={i === index || undefined} className="flex size-7 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-white">
                <span className={`size-2 rounded-full ${i === index ? 'bg-white' : 'bg-white/50'}`} />
              </button>
            ))}
            <button type="button" onClick={() => setChoice(!playing)} aria-label={playing ? 'Pause carousel' : 'Play carousel'} className="flex size-7 cursor-pointer items-center justify-center rounded-full text-white focus-visible:outline-2 focus-visible:outline-white">
              <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
                {playing ? <path d="M2 1h3v10H2zM7 1h3v10H7z" fill="currentColor" /> : <path d="M2 1l9 5-9 5z" fill="currentColor" />}
              </svg>
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
