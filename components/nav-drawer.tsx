'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { signOut } from '@/app/actions/auth'
import { ChevronIcon, CloseIcon, MenuIcon, UserIcon } from './icons'

type Department = { slug: string; name: string; categories: { slug: string; name: string }[] }

export function NavDrawer({ departments, userName, variant }: { departments: Department[]; userName: string | null; variant: 'icon' | 'all' }) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  const item = 'block px-8 py-3 hover:bg-page'
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-label="Open menu: all departments"
        className={variant === 'icon' ? 'nav-item cursor-pointer p-1.5 md:hidden' : 'nav-item hidden cursor-pointer items-center gap-1 px-2 py-1.5 font-bold md:flex'}
      >
        <MenuIcon className={variant === 'icon' ? 'size-7' : 'size-5'} />
        {variant === 'all' && 'All'}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="All departments">
          <div className="absolute inset-0 bg-black/75" onClick={() => setOpen(false)} />
          <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="absolute top-3 left-[min(365px,85vw)] ml-3 cursor-pointer text-white">
            <CloseIcon className="size-7" />
          </button>
          <nav
            className="absolute inset-y-0 left-0 w-[min(365px,85vw)] animate-[slide-in_.18s_ease-out] overflow-y-auto bg-white pb-6 text-[15px] text-ink"
            onClick={(e) => (e.target as HTMLElement).closest('a') && setOpen(false)}
          >
            <Link href={userName ? '/account' : '/ap/signin'} className="flex items-center gap-3 bg-nav-light px-8 py-3.5 text-lg font-bold text-white">
              <UserIcon className="size-7 rounded-full bg-white p-1 text-nav-light" /> Hello, {userName ?? 'sign in'}
            </Link>

            <h2 className="px-8 pt-5 pb-2 text-lg">Trending</h2>
            <Link href="/bestsellers" className={item}>Best Sellers</Link>
            <Link href="/deals" className={item}>Today&apos;s Deals</Link>
            <Link href="/s?sort=newest" className={item}>New Releases</Link>

            <h2 className="mt-2 border-t border-line px-8 pt-5 pb-2 text-lg">Shop by Department</h2>
            <ul>
              {departments.map((d) => (
                <li key={d.slug}>
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === d.slug ? null : d.slug)}
                    aria-expanded={expanded === d.slug}
                    className={`${item} flex w-full cursor-pointer items-center justify-between text-left`}
                  >
                    {d.name}
                    <ChevronIcon className={`size-4 text-muted transition ${expanded === d.slug ? 'rotate-90' : ''}`} />
                  </button>
                  {expanded === d.slug && (
                    <ul className="bg-[#f7f8f8] py-1">
                      <li><Link href={`/s?i=${d.slug}`} className="block px-12 py-2 font-bold hover:bg-page">All {d.name}</Link></li>
                      {d.categories.map((c) => (
                        <li key={c.slug}><Link href={`/s?i=${c.slug}`} className="block px-12 py-2 hover:bg-page">{c.name}</Link></li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>

            <h2 className="mt-2 border-t border-line px-8 pt-5 pb-2 text-lg">Help &amp; Settings</h2>
            <Link href="/account" className={item}>Your Account</Link>
            <Link href="/orders" className={item}>Your Orders</Link>
            <Link href="/lists" className={item}>Your Lists</Link>
            {userName ? (
              <form action={signOut}>
                <button type="submit" className={`${item} w-full cursor-pointer text-left`}>Sign Out</button>
              </form>
            ) : (
              <Link href="/ap/signin" className={item}>Sign in</Link>
            )}
          </nav>
        </div>
      )}
    </>
  )
}
