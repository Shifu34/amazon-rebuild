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
  // arrowing through queries previews each one in the box, like Amazon; typing then edits the previewed text
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
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        choose(active)
      }}
      className="relative order-last flex h-10 w-full rounded-md text-ink focus-within:ring-[3px] focus-within:ring-brand md:order-none md:mx-3.5 md:flex-1 md:rounded"
    >
      {/* phones get a full-width box, like Amazon's mobile web */}
      <label className="relative hidden shrink-0 cursor-pointer items-center rounded-l border-r border-[#cdcdcd] bg-[#e6e6e6] pr-2 pl-3 text-xs text-[#555] hover:bg-[#d4d4d4] hover:text-ink md:flex">
        <span className="pointer-events-none max-w-24 truncate">{scopeLabel}</span>
        <CaretIcon className="pointer-events-none ml-3 h-[5px] w-2 shrink-0" />
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
        className="min-w-0 flex-1 bg-white px-2.5 text-[15px] outline-none placeholder:text-[#6f7373] max-md:rounded-l-md"
      />

      <button type="submit" aria-label="Go" className="flex w-11 shrink-0 cursor-pointer items-center justify-center rounded-r-md bg-search hover:bg-search-hover md:w-[45px] md:rounded-r">
        <SearchIcon className="size-5 text-ink md:size-6" />
      </button>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          onMouseDown={(e) => e.preventDefault()}
          className="absolute top-full right-11 left-0 z-50 md:right-[45px] mt-px overflow-hidden rounded-b-md border border-line bg-white py-1 shadow-lg"
        >
          {options.map((o, index) => (
            <li
              key={o.kind === 'term' ? `t-${o.term}` : `p-${o.p.id}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={active === index}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(index)}
              className={`flex cursor-pointer items-center gap-3 px-3 py-1.5 ${active === index ? 'bg-page' : ''} ${o.kind === 'product' && terms.length && index === terms.length ? 'mt-1 border-t border-line pt-2' : ''}`}
            >
              {o.kind === 'term' ? (
                <>
                  <SearchIcon className="size-4 shrink-0 text-muted" />
                  {/* what was typed in normal weight, the completion around it in bold, like Amazon */}
                  <span className="truncate">
                    {o.at < 0 ? (
                      o.term // an earlier answer still on screen while the next one loads
                    ) : (
                      <>
                        <b>{o.term.slice(0, o.at)}</b>
                        {o.term.slice(o.at, o.at + prefix.length)}
                        <b>{o.term.slice(o.at + prefix.length)}</b>
                      </>
                    )}
                  </span>
                </>
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={o.p.thumbnail} alt="" className="size-10 shrink-0 object-contain" />
                  <span className="min-w-0 flex-1 truncate">{o.p.title}</span>
                  <span className="shrink-0 font-bold">{formatDollars(o.p.price, currency, rate)}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}
