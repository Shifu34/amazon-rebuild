'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { signOut } from '@/app/actions/auth'
import { CaretIcon, ChevronIcon, CloseIcon, MenuIcon, UserIcon } from './icons'

// The header's client pieces: the All drawer, the Account & Lists menu and the guest location dialog.

type Department = { slug: string; name: string; categories: { slug: string; name: string }[] }

export function NavDrawer({ departments, userName, variant }: { departments: Department[]; userName: string | null; variant: 'icon' | 'all' }) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)

  // a modal <dialog> keeps Tab inside, makes the page behind inert and closes on Escape
  useEffect(() => {
    if (!open) return
    dialog.current?.showModal()
    closeButton.current?.focus()
  }, [open])
  const close = () => dialog.current?.close()

  const item = 'block px-8 py-3 hover:bg-page'
  return (
    <>
      <button
        ref={trigger}
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
        <dialog
          ref={dialog}
          aria-label="All departments"
          onClose={() => {
            setOpen(false)
            trigger.current?.focus()
          }}
          className="fixed inset-0 m-0 size-full max-h-none max-w-none overflow-hidden bg-transparent p-0 backdrop:bg-transparent"
        >
          <div className="absolute inset-0 bg-black/75" onClick={close} />
          <button ref={closeButton} type="button" onClick={close} aria-label="Close menu" className="absolute top-3 left-[min(365px,85vw)] ml-3 cursor-pointer text-white">
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
              // the header outlives the redirect, so close here like a link does (closing on click would remove the form before it submits)
              <form action={signOut} onSubmit={close}>
                <button type="submit" className={`${item} w-full cursor-pointer text-left`}>Sign Out</button>
              </form>
            ) : (
              <Link href="/ap/signin" className={item}>Sign in</Link>
            )}
          </nav>
        </dialog>
      )}
    </>
  )
}

// Account & Lists and EN: a mouse opens them on hover (after a short intent delay) and the page below the header dims.
// A real toggle button serves keyboard and touch, so the panel's links only join the tab order when it's open. Escape,
// clicking away, or choosing a link or Sign Out closes it (the header outlives navigation, so nothing else would).
// With `href` the label is a link and the caret beside it toggles; without, the whole label is the toggle.
export function Flyout({ href, label, toggleLabel, className, panelClassName, children }: {
  href?: string
  label: React.ReactNode
  toggleLabel: string
  className: string
  panelClassName: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const hovering = useRef(false)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      if (root.current?.contains(document.activeElement)) toggle.current?.focus()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const caret = <CaretIcon className={`h-[5px] w-2 shrink-0 self-end text-[#a7acb2] ${href ? 'mb-3' : 'mb-[15px]'}`} />
  const focus = 'cursor-pointer focus-visible:outline-1 focus-visible:outline-white'
  const toggleButton = (className: string, content: React.ReactNode) => (
    <button
      ref={toggle}
      type="button"
      // a click while the mouse already holds the menu open keeps it open instead of snapping it shut
      onClick={() => setOpen(hovering.current || !open)}
      aria-expanded={open}
      aria-controls={id}
      aria-label={toggleLabel}
      className={`flex ${focus} ${className}`}
    >
      {content}
    </button>
  )

  return (
    <div
      ref={root}
      className={`relative ${className}`}
      onPointerEnter={(e) => {
        if (e.pointerType !== 'mouse') return
        hovering.current = true
        timer.current = setTimeout(() => setOpen(true), 150)
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== 'mouse') return
        hovering.current = false
        clearTimeout(timer.current)
        setOpen(false)
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false)
      }}
    >
      <div className={`flex h-[50px] rounded-[2px] border hover:border-white ${open ? 'border-white' : 'border-transparent'}`}>
        {href ? (
          <>
            <Link href={href} className={`flex flex-col justify-center pl-[9px] ${focus}`}>{label}</Link>
            {toggleButton('pr-[9px] pl-1', caret)}
          </>
        ) : (
          toggleButton('items-center gap-0.5 px-[9px]', <>{label}{caret}</>)
        )}
      </div>
      {/* the header is a stacking context, so -z-10 dims the page but not the header's own bars */}
      {open && <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-black/60" />}
      <div
        id={id}
        hidden={!open}
        onClick={(e) => (e.target as HTMLElement).closest('a') && setOpen(false)}
        onSubmit={() => setOpen(false)}
        className={`absolute top-full ${panelClassName}`}
      >
        {children}
      </div>
    </div>
  )
}

const ZIP = /^\d{5}$/

// "Choose your location" for guests: sign in for saved addresses, or set a ZIP that the header reads from a cookie.
// Applies in place (router.refresh) instead of reloading the page like Amazon.
export function LocationPicker({ zip, className, children }: { zip?: string; className: string; children: React.ReactNode }) {
  const router = useRouter()
  const dialog = useRef<HTMLDialogElement>(null)
  const [invalid, setInvalid] = useState(false)
  const id = useId()
  const close = () => dialog.current?.close()

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          setInvalid(false)
          dialog.current?.showModal()
        }}
        className={className}
      >
        {children}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        onClick={(e) => e.target === e.currentTarget && close()}
        className="m-auto w-[min(375px,calc(100vw-2rem))] overflow-hidden rounded-lg bg-white p-0 text-left text-ink shadow-xl backdrop:bg-black/60"
      >
        <div className="flex items-center justify-between bg-[#f0f2f2] py-2 pr-2 pl-5">
          <h2 id={`${id}-title`} className="text-base">Choose your location</h2>
          <button type="button" onClick={close} aria-label="Close" className="cursor-pointer rounded-sm p-2 hover:bg-[#e3e6e6]">
            <CloseIcon className="size-4" />
          </button>
        </div>
        <div className="p-5">
          <Link href="/ap/signin?return_to=/account/addresses" onClick={close} className="btn btn-cart btn-lg w-full">Sign in to see your addresses</Link>
          <p className="my-4 flex items-center gap-3 text-xs text-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
            or enter a US zip code
          </p>
          <form
            noValidate
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const value = String(new FormData(e.currentTarget).get('zip') ?? '').trim()
              if (!ZIP.test(value)) return setInvalid(true)
              document.cookie = `zip=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
              close()
              router.refresh()
            }}
          >
            <input
              name="zip"
              defaultValue={zip}
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              aria-label="US zip code"
              aria-invalid={invalid}
              aria-describedby={invalid ? `${id}-error` : undefined}
              className="input h-9"
            />
            <button type="submit" className="btn btn-plain btn-lg">Apply</button>
          </form>
          {invalid && <p id={`${id}-error`} role="alert" className="field-error">Please enter a valid US zip code</p>}
        </div>
      </dialog>
    </>
  )
}
