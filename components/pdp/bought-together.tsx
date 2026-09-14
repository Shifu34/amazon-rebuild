'use client'

import Link from 'next/link'
import { Fragment, useActionState, useState } from 'react'
import { addBundle, type BundleState } from '@/app/actions/bundle'
import { Price } from '@/components/price'
import { usd, usdCents } from '@/lib/format'
import { AddedSheet, type CartTotals } from './added-sheet'

type Item = { id: number; title: string; thumbnail: string; price: number }

// "Frequently bought together": the first item is the product being viewed.
export function BoughtTogether({ items, cart }: { items: Item[]; cart: CartTotals }) {
  const [checked, setChecked] = useState(() => items.map(() => true))
  const [state, action, pending] = useActionState<BundleState, FormData>(addBundle, null)
  const [dismissed, setDismissed] = useState<BundleState>(null)

  const chosen = items.filter((_, i) => checked[i])
  const totalCents = chosen.reduce((sum, p) => sum + Math.round(p.price * 100), 0)
  const label = chosen.length === 3 ? 'Add all 3 to Cart' : chosen.length === 2 ? 'Add both to Cart' : chosen.length > 3 ? `Add all ${chosen.length} to Cart` : 'Add to Cart'

  return (
    <section aria-labelledby="fbt-title" className="border-t border-line py-6">
      <h2 id="fbt-title" className="mb-4 text-xl">Frequently bought together</h2>
      <form action={action} className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-10">
        <div className="flex items-center gap-2" aria-hidden>
          {items.map((p, i) => (
            <Fragment key={p.id}>
              {i > 0 && <span className="text-2xl text-muted">+</span>}
              <span className={`flex size-24 items-center justify-center rounded-sm bg-[#f7f7f7] p-2 transition-opacity sm:size-32 ${checked[i] ? '' : 'opacity-35'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumbnail} alt="" loading="lazy" className="max-h-full max-w-full object-contain mix-blend-multiply" />
              </span>
            </Fragment>
          ))}
        </div>

        <div className="lg:order-last lg:w-56">
          <p className="text-base">
            Total price: <span className="text-xl font-bold"><Price value={totalCents / 100} /></span>
          </p>
          <span className="sr-only" aria-live="polite">Total price {usdCents(totalCents)} for {chosen.length} items</span>
          <button type="submit" disabled={pending || !chosen.length} className="btn btn-cart mt-2 w-full">
            {pending ? 'Adding…' : label}
          </button>
          {state && !state.ok && <p role="alert" className="field-error">{state.error}</p>}
        </div>

        <ul className="space-y-2 text-sm lg:flex-1">
          {items.map((p, i) => (
            <li key={p.id} className="flex items-start gap-2">
              <input
                id={`fbt-${p.id}`}
                type="checkbox"
                name="productId"
                value={p.id}
                checked={checked[i]}
                onChange={() => setChecked((c) => c.map((v, j) => (j === i ? !v : v)))}
                className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[#007185]"
              />
              <label htmlFor={`fbt-${p.id}`} className="cursor-pointer">
                {i === 0 ? <b>This item: </b> : null}
                {i === 0 ? p.title : <Link href={`/dp/${p.id}`} className="link">{p.title}</Link>} <b className="text-danger">{usd(p.price)}</b>
              </label>
            </li>
          ))}
        </ul>
      </form>
      <AddedSheet
        open={!!state?.ok && dismissed !== state}
        onClose={() => setDismissed(state)}
        items={state?.ok ? items.filter((p) => state.ids.includes(p.id)) : []}
        cart={cart}
      />
    </section>
  )
}
