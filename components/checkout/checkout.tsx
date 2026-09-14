'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { placeOrder, type PlaceOrderState } from '@/app/actions/checkout'
import { AddressForm } from '@/components/address-form'
import { CardForm } from '@/components/card-form'
import type { Address } from '@/lib/addresses'
import { longDate, plural, usd, usdCents } from '@/lib/format'
import type { Quote, Speed } from '@/lib/orders'
import type { Card } from '@/lib/payments'
import { CheckCircleIcon } from './icons'

type Line = { id: number; title: string; thumbnail: string; price: number; quantity: number; stock: number }
type View = 'summary' | 'list' | 'new'
type Props = {
  token: string
  buy: { id: string; qty: number } | null
  lines: Line[]
  linesKey: string
  quotes: Record<Speed, Quote>
  taxRate: number
  addresses: (Address & { oneLine: string })[]
  cards: (Card & { label: string; expiry: string })[]
  notices: string[]
}

const LEGAL = "By placing your order, you agree to nile's privacy notice and conditions of use."

export function Checkout({ token, buy, lines, linesKey, quotes, taxRate, addresses, cards, notices }: Props) {
  const [addressId, setAddressId] = useState(addresses[0]?.id ?? '')
  const [addressView, setAddressView] = useState<View>('summary')
  const [cardId, setCardId] = useState(cards.find((c) => !c.expired)?.id ?? '')
  const [cardView, setCardView] = useState<View>('summary')
  const [speed, setSpeed] = useState<Speed>('standard')
  const [state, place, placing] = useActionState<PlaceOrderState, FormData>(placeOrder, null)
  const alertRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (state?.error) alertRef.current?.focus()
  }, [state])

  const address = addresses.find((a) => a.id === addressId)
  const card = cards.find((c) => c.id === cardId && !c.expired)
  // a summary needs something selected; otherwise fall back to the list, or the form when there is nothing saved
  const aView = addressView === 'summary' && !address ? (addresses.length ? 'list' : 'new') : addressView
  const cView = cardView === 'summary' && !card ? (cards.length ? 'list' : 'new') : cardView
  const q = quotes[speed]
  const blocker = !address ? 'Add a delivery address to continue.' : !card ? 'Add a payment method to continue.' : null

  const placeButton = (className: string) => (
    <button type="submit" form="place-order" disabled={placing || !!blocker} className={`btn btn-cart btn-lg ${className}`}>
      {placing ? 'Placing your order…' : 'Place your order'}
    </button>
  )

  return (
    <div className="mx-auto grid w-full max-w-[1150px] gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:py-6">
      <form id="place-order" action={place} hidden>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="lines" value={linesKey} />
        {buy && <input type="hidden" name="buy" value={buy.id} />}
        {buy && <input type="hidden" name="qty" value={buy.qty} />}
        <input type="hidden" name="addressId" value={address?.id ?? ''} />
        <input type="hidden" name="cardId" value={card?.id ?? ''} />
        <input type="hidden" name="speed" value={speed} />
      </form>

      <div className="min-w-0 space-y-4">
        {state?.error && (
          <div ref={alertRef} tabIndex={-1} role="alert" className="rounded-lg border border-[#cc0c39] bg-white px-4 py-3 shadow-[0_0_0_4px_#fcf4f4_inset] outline-none">
            <p className="font-bold text-[#cc0c39]">There was a problem</p>
            <p className="text-sm">{state.error}</p>
          </div>
        )}
        {notices.length > 0 && (
          <div className="rounded-lg border border-[#ffb14a] bg-white px-4 py-3 shadow-[0_0_0_4px_#fffaf3_inset]">
            <p className="font-bold">Important message</p>
            <ul className="list-disc pl-5 text-sm">
              {notices.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        )}

        {aView === 'summary' && address ? (
          <Section done title={`Delivering to ${address.fullName}`} onChange={() => setAddressView('list')} changeLabel="Change delivery address">
            <p className="text-sm">{address.oneLine}</p>
            {address.instructions && <p className="mt-1 text-xs text-muted">Delivery instructions: {address.instructions}</p>}
          </Section>
        ) : aView === 'list' ? (
          <Section title="Select a delivery address">
            <Choices
              legend="Delivery address"
              options={addresses.map((a) => ({
                id: a.id,
                label: (
                  <>
                    <b>{a.fullName}</b> {a.oneLine}
                    {a.isDefault && <span className="text-muted"> (Default)</span>}
                    <span className="block text-muted">Phone number: {a.phone}</span>
                  </>
                ),
              }))}
              value={addressId}
              onChange={setAddressId}
            />
            <button type="button" onClick={() => setAddressView('new')} className="link mt-3 block cursor-pointer text-sm">+ Add a new delivery address</button>
            <button type="button" onClick={() => setAddressView('summary')} disabled={!address} className="btn btn-cart mt-3">Deliver to this address</button>
          </Section>
        ) : (
          <Section title="Enter a new delivery address">
            <AddressForm
              submitLabel="Use this address"
              onSaved={(id) => {
                setAddressId(id)
                setAddressView('summary')
              }}
              onCancel={addresses.length ? () => setAddressView('list') : undefined}
            />
          </Section>
        )}

        {cView === 'summary' && card ? (
          <Section done title={`Paying with ${card.label}`} onChange={() => setCardView('list')} changeLabel="Change payment method">
            <p className="text-sm text-muted">
              {card.nameOnCard} · Expires {card.expiry}
            </p>
          </Section>
        ) : cView === 'list' ? (
          <Section title="Payment method">
            <h3 className="mb-2 text-sm">Your credit and debit cards</h3>
            <Choices
              legend="Payment method"
              options={cards.map((c) => ({
                id: c.id,
                disabled: c.expired,
                label: (
                  <>
                    <b>{c.label}</b>, {c.expired ? <span className="text-danger">expired {c.expiry}</span> : `expires ${c.expiry}`}
                    <span className="block text-muted">{c.nameOnCard}</span>
                  </>
                ),
              }))}
              value={cardId}
              onChange={setCardId}
            />
            <button type="button" onClick={() => setCardView('new')} className="link mt-3 block cursor-pointer text-sm">+ Add a credit or debit card</button>
            <button type="button" onClick={() => setCardView('summary')} disabled={!card} className="btn btn-cart mt-3">Use this payment method</button>
          </Section>
        ) : (
          <Section title="Add a credit or debit card">
            <CardForm
              onSaved={(id) => {
                setCardId(id)
                setCardView('summary')
              }}
              onCancel={cards.length ? () => setCardView('list') : undefined}
            />
          </Section>
        )}

        <section aria-labelledby="review-heading" className="rounded-lg border border-line bg-white p-4 sm:p-5">
          <h2 id="review-heading" className="text-lg leading-6 text-success">Arriving {longDate(q.deliverBy)}</h2>
          <p className="text-xs text-muted">{buy ? 'Buying now: the items in your cart are not affected.' : `${plural(q.itemCount, 'item')} from your cart`}</p>
          <div className="mt-3 grid gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
            <ul className="space-y-3">
              {lines.map((l) => (
                <li key={l.id} className="flex gap-3">
                  <div className="flex size-20 shrink-0 items-center justify-center rounded-sm bg-[#f7f7f7] p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={l.thumbnail} alt="" className="max-h-full max-w-full object-contain mix-blend-multiply" />
                  </div>
                  <div className="min-w-0 text-sm">
                    <p className="line-clamp-2 font-bold">{l.title}</p>
                    <p className="font-bold text-danger">{usd(l.price)}</p>
                    <p>Qty: {l.quantity}</p>
                    {l.stock < 10 && <p className="text-xs text-danger">Only {l.stock} left in stock - order soon.</p>}
                  </div>
                </li>
              ))}
            </ul>
            <fieldset>
              <legend className="mb-1 text-sm font-bold">Choose your delivery option:</legend>
              {(['standard', 'expedited'] as const).map((s) => {
                const o = quotes[s]
                const price = o.freeShippingCents ? 'FREE' : usdCents(o.shippingCents)
                return (
                  <label key={s} className="flex cursor-pointer gap-2 rounded-md p-1.5 text-sm has-[:checked]:bg-[#f0f8f9]">
                    <input type="radio" name="delivery-speed" checked={speed === s} onChange={() => setSpeed(s)} className="mt-0.5 size-4 shrink-0 accent-link" />
                    <span>
                      <b className="text-success">{longDate(o.deliverBy)}</b>
                      <span className="block">
                        {price} {s === 'standard' ? 'Standard Delivery' : 'Expedited Delivery'}
                        <span className="text-xs text-muted"> · {s === 'standard' ? 'Cheapest' : 'Fastest'}</span>
                      </span>
                    </span>
                  </label>
                )
              })}
            </fieldset>
          </div>
        </section>

        <section aria-label="Place your order" className="flex flex-col gap-3 rounded-lg border border-line bg-white p-4 sm:flex-row sm:items-center sm:p-5">
          {placeButton('w-full sm:w-auto sm:px-8')}
          <div>
            <p className="text-lg font-bold text-danger">Order total: {usdCents(q.totalCents)}</p>
            <p className="text-xs">{blocker ? <span className="text-danger">{blocker}</span> : LEGAL}</p>
          </div>
        </section>
        <p className="px-1 text-xs text-muted">
          When you place your order you&apos;ll see a confirmation right away. This is a demo store: nothing is charged and nothing ships.
        </p>
      </div>

      <aside aria-label="Order summary" className="self-start lg:sticky lg:top-4">
        <div className="rounded-lg border border-line bg-white p-4">
          {placeButton('w-full')}
          <p className="mt-2 text-center text-xs">{LEGAL}</p>
          {blocker && <p className="mt-1 text-center text-xs text-danger">{blocker}</p>}
          <hr className="my-3 border-line" />
          <h2 className="mb-2 text-lg leading-6">Order Summary</h2>
          <dl className="space-y-1 text-[13px]">
            <Row label={`Items (${q.itemCount}):`} value={usdCents(q.itemsCents)} />
            <Row label="Shipping & handling:" value={usdCents(q.shippingCents)} />
            {q.freeShippingCents > 0 && <Row label="Free Shipping:" value={`-${usdCents(q.freeShippingCents)}`} />}
            <Row label="Total before tax:" value={usdCents(q.beforeTaxCents)} />
            <Row label="Estimated tax to be collected:" value={usdCents(q.taxCents)} />
            <Row label="Order total:" value={usdCents(q.totalCents)} total />
          </dl>
          <p className="mt-3 text-xs text-muted">Estimated tax is a flat {(taxRate * 100).toFixed(2)}% of items and shipping.</p>
        </div>
      </aside>
    </div>
  )
}

function Section({ title, done, onChange, changeLabel, children }: { title: string; done?: boolean; onChange?: () => void; changeLabel?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white p-4 sm:p-5">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg leading-6">
          {done && <CheckCircleIcon className="size-5 shrink-0 text-success" />}
          {title}
        </h2>
        {onChange && (
          <button type="button" onClick={onChange} aria-label={changeLabel} className="link cursor-pointer text-sm">Change</button>
        )}
      </div>
      {children}
    </section>
  )
}

function Choices({ legend, options, value, onChange }: { legend: string; options: { id: string; label: React.ReactNode; disabled?: boolean }[]; value: string; onChange: (id: string) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">{legend}</legend>
      {options.map((o) => (
        <label
          key={o.id}
          className={`flex gap-3 rounded-lg border p-3 text-sm ${o.id === value ? 'border-[#fbd8b4] bg-[#fcf5ee]' : 'border-line'} ${o.disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
        >
          <input type="radio" name={legend} checked={o.id === value} disabled={o.disabled} onChange={() => onChange(o.id)} className="mt-0.5 size-4 shrink-0 accent-link" />
          <span>{o.label}</span>
        </label>
      ))}
    </fieldset>
  )
}

function Row({ label, value, total }: { label: string; value: string; total?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${total ? 'mt-2 border-t border-line pt-2 text-lg font-bold text-danger' : ''}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
