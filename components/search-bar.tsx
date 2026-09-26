'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useId, useState } from 'react'
import { formatDollars } from '@/lib/region'
import { CaretIcon, SearchIcon } from './icons'
import { useRegion } from './region-provider'

type Suggestions = { terms: string[]; products: { id: number; title: string; thumbnail: string; price: number }[] }
const EMPTY: Suggestions = { terms: [], products: [] }

// Remount when the URL's query changes so the box always reflects the page being viewed.
export function SearchBar(props: { departments: { slug: string; name: string }[] }) {
  const params = useSearchParams()
  const k = params.get('k') ?? ''
  const i = params.get('i') ?? ''
  return <SearchBox key={`${k}|${i}`} initialQuery={k} initialScope={i} {...props} />
}

function SearchBox({ departments, initialQuery, initialScope }: { departments: { slug: string; name: string }[]; initialQuery: string; initialScope: string }) {
  const router = useRouter()
  const { currency, rate } = useRegion()
  const [q, setQ] = useState(initialQuery)
  const [scope, setScope] = useState(initialScope)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  // recent answers, newest first, so backspacing and retyping show suggestions instantly
  const [seen, setSeen] = useState<{ key: string; data: Suggestions }[]>([])
  const listId = useId()
  const prefix = q.trim().toLowerCase()

  useEffect(() => {
    if (!prefix) return
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      fetch(`/api/suggest?q=${encodeURIComponent(prefix)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((data: Suggestions) => setSeen((s) => [{ key: prefix, data }, ...s.filter((x) => x.key !== prefix)].slice(0, 20)))
        .catch(() => {})
    }, 100)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [prefix])

  // where the typed text starts a word of the term (for the bold completion), or -1
  const at = (t: string) => (t.startsWith(prefix) ? 0 : t.indexOf(` ${prefix}`) + 1 || -1)
  const words = prefix.split(/\s+/).filter(Boolean)
  const fits = (title: string) => {
    const titleWords = title.toLowerCase().split(/[^\p{L}\p{N}]+/u)
    return words.every((w) => titleWords.some((t) => t.startsWith(w)))
  }
  // Use the answer for exactly what's typed once it arrives. Until then keep the latest answer, trimmed to the rows that
  // still fit, or untrimmed when none do, so the list never blinks shut and pops back open over the page while typing.
  const exact = seen.find((x) => x.key === prefix)?.data
  const latest = seen[0]?.data ?? EMPTY
  const fitting = { terms: latest.terms.filter((t) => at(t) >= 0), products: latest.products.filter((p) => fits(p.title)) }
  const data: Suggestions = !prefix ? EMPTY : exact ?? (fitting.terms.length + fitting.products.length ? fitting : latest)
  const terms = data.terms
  const options = [...terms.map((term) => ({ kind: 'term' as const, term, at: at(term) })), ...data.products.map((p) => ({ kind: 'product' as const, p }))]
  const showList = open && options.length > 0
  const highlighted = options[active]
  // arrowing through queries previews each one in the box; typing then edits the previewed text
  const shown = highlighted?.kind === 'term' ? highlighted.term : q

  const submit = (term: string) => {
    setOpen(false)
    // an empty search in All goes nowhere; with a department it opens that department
    if (!term.trim() && !scope) return
    const sp = new URLSearchParams()
    if (term.trim()) sp.set('k', term.trim())
    if (scope) sp.set('i', scope)
    router.push(`/s?${sp}`)
  }

  const choose = (index: number) => {
    const o = options[index]
    if (!o) return submit(q)
    if (o.kind === 'term') {
      setQ(o.term)
      submit(o.term)
    } else {
      setOpen(false)
      router.push(`/dp/${o.p.id}`)
    }
  }

  const scopeLabel = departments.find((d) => d.slug === scope)?.name ?? 'All'

  return (
    // docs/design.md: one field with a hairline, not a scope block welded to a coloured button
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        choose(active)
      }}
      className="relative order-last flex h-10 w-full items-center rounded-md border border-line bg-surface focus-within:outline-2 focus-within:outline-offset-[-1px] focus-within:outline-accent md:order-none md:mx-4 md:max-w-[560px] md:flex-1"
    >
      {/* the department scope stays, as a quiet label inside the field */}
      <label className="relative hidden h-full shrink-0 cursor-pointer items-center gap-1.5 border-r border-line pr-2.5 pl-3 text-sm text-muted hover:text-ink md:flex">
        <span className="pointer-events-none max-w-24 truncate">{scopeLabel}</span>
        <CaretIcon className="pointer-events-none h-[5px] w-2 shrink-0" />
        <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Search in" className="absolute inset-0 cursor-pointer opacity-0">
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.slug} value={d.slug}>{d.name}</option>
          ))}
        </select>
      </label>

      <input
        value={shown}
        onChange={(e) => {
          setQ(e.target.value)
          setActive(-1)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            setOpen(true)
            const n = options.length
            if (n) setActive((a) => (e.key === 'ArrowDown' ? (a + 1) % n : (a - 1 + n) % n))
          } else if (e.key === 'Escape') {
            setOpen(false)
            setActive(-1)
          }
        }}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        aria-label="Search nile"
        placeholder="Search nile"
        autoComplete="off"
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent px-3 text-[15px] outline-none placeholder:text-muted"
      />

      <button
        type="submit"
        aria-label="Go"
        className="mr-1 grid size-8 shrink-0 cursor-pointer place-items-center rounded text-muted hover:bg-page hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <SearchIcon className="size-5" />
      </button>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          onMouseDown={(e) => e.preventDefault()}
          className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-[10px] border border-line bg-surface py-1.5 shadow-[0_12px_30px_rgba(25,23,19,0.14)]"
        >
          {options.map((o, index) => (
            <li
              key={o.kind === 'term' ? `t-${o.term}` : `p-${o.p.id}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={active === index}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(index)}
              className={`flex cursor-pointer items-center gap-3 px-3.5 py-2 text-[15px] ${active === index ? 'bg-page' : ''} ${o.kind === 'product' && terms.length && index === terms.length ? 'mt-1.5 border-t border-line pt-3' : ''}`}
            >
              {o.kind === 'term' ? (
                <>
                  <SearchIcon className="size-4 shrink-0 text-muted" />
                  {/* what was typed stays light, the completion around it goes semibold */}
                  <span className="truncate">
                    {o.at < 0 ? (
                      o.term // an earlier answer still on screen while the next one loads
                    ) : (
                      <>
                        <b className="font-semibold">{o.term.slice(0, o.at)}</b>
                        {o.term.slice(o.at, o.at + prefix.length)}
                        <b className="font-semibold">{o.term.slice(o.at + prefix.length)}</b>
                      </>
                    )}
                  </span>
                </>
              ) : (
                <>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-page p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={o.p.thumbnail} alt="" className="max-h-full max-w-full object-contain mix-blend-multiply" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{o.p.title}</span>
                  <span className="price shrink-0 text-sm font-medium">{formatDollars(o.p.price, currency, rate)}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}
