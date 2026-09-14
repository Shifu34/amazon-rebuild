'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useId, useState } from 'react'
import { usd } from '@/lib/format'
import { SearchIcon } from './icons'

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
  const [q, setQ] = useState(initialQuery)
  const [scope, setScope] = useState(initialScope)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [results, setResults] = useState<{ q: string; data: Suggestions }>({ q: '', data: EMPTY })
  const listId = useId()

  useEffect(() => {
    if (!q.trim()) return
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      fetch(`/api/suggest?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((data: Suggestions) => setResults({ q, data }))
        .catch(() => {})
    }, 120)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [q])

  const data = q.trim() && results.q === q ? results.data : EMPTY
  const options = [...data.terms.map((term) => ({ kind: 'term' as const, term })), ...data.products.map((p) => ({ kind: 'product' as const, p }))]
  const showList = open && options.length > 0

  const submit = (term: string) => {
    setOpen(false)
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
  const prefix = q.trim().toLowerCase()

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        choose(active)
      }}
      className="relative order-last flex h-10 w-full rounded-md text-ink focus-within:ring-[3px] focus-within:ring-brand md:order-none md:mx-2 md:flex-1"
    >
      <label className="relative flex shrink-0 cursor-pointer items-center rounded-l-md border-r border-[#cdcdcd] bg-[#e6e6e6] px-2 text-xs text-[#555] hover:bg-[#d4d4d4] hover:text-ink">
        <span className="pointer-events-none max-w-24 truncate">{scopeLabel}</span>
        <span className="pointer-events-none ml-1 text-[9px]">▼</span>
        <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Search in" className="absolute inset-0 cursor-pointer opacity-0">
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.slug} value={d.slug}>{d.name}</option>
          ))}
        </select>
      </label>

      <input
        value={q}
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
          }
        }}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        aria-label="Search nile"
        placeholder="Search nile"
        autoComplete="off"
        spellCheck={false}
        className="min-w-0 flex-1 bg-white px-2.5 text-[15px] outline-none"
      />

      <button type="submit" aria-label="Go" className="flex w-11 shrink-0 cursor-pointer items-center justify-center rounded-r-md bg-search hover:bg-search-hover">
        <SearchIcon className="size-5 text-ink" />
      </button>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          onMouseDown={(e) => e.preventDefault()}
          className="absolute top-full right-11 left-0 z-50 mt-px overflow-hidden rounded-b-md border border-line bg-white py-1 shadow-lg"
        >
          {options.map((o, index) => (
            <li
              key={o.kind === 'term' ? `t-${o.term}` : `p-${o.p.id}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={active === index}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(index)}
              className={`flex cursor-pointer items-center gap-3 px-3 py-1.5 ${active === index ? 'bg-page' : ''} ${o.kind === 'product' && data.terms.length && index === data.terms.length ? 'mt-1 border-t border-line pt-2' : ''}`}
            >
              {o.kind === 'term' ? (
                <>
                  <SearchIcon className="size-4 shrink-0 text-muted" />
                  <span className="truncate">
                    {o.term.startsWith(prefix) ? (
                      <>
                        {prefix}
                        <b>{o.term.slice(prefix.length)}</b>
                      </>
                    ) : (
                      o.term
                    )}
                  </span>
                </>
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={o.p.thumbnail} alt="" className="size-10 shrink-0 object-contain" />
                  <span className="min-w-0 flex-1 truncate">{o.p.title}</span>
                  <span className="shrink-0 font-bold">{usd(o.p.price)}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}
