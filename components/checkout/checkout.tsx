'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { removeFromCart, updateQuantity } from '@/app/actions/cart'
import { placedOrderId, placeOrder, type PlaceOrderState } from '@/app/actions/checkout'
import { saveNileDay } from '@/app/actions/nile-day'
import { AddressForm } from '@/components/address-form'
import { CardForm } from '@/components/card-form'
import { useRegion } from '@/components/region-provider'
import type { Address } from '@/lib/addresses'
import { DAY_NAMES, DEFAULT_DAY } from '@/lib/delivery'
import { longDate, plural, toCents } from '@/lib/format'
import type { Quote, Speed } from '@/lib/orders'
import type { Card } from '@/lib/payments'
import { countryCodeFromName, formatDollars, formatMoney, type CountryCode } from '@/lib/region'
import { CheckCircleIcon } from './icons'
import { shipments } from './shipments'
import { deliveryName, summaryRows } from './summary'

type Line = { id: number; title: string; thumbnail: string; price: number; quantity: number; stock: number; max: number; arrives: Record<CountryCode, Record<Speed, Date>> }
type View = 'summary' | 'list' | 'new'
type Props = {
  token: string
  buy: { id: string; qty: number } | null
  lines: Line[]
  linesKey: string
  quotes: Record<CountryCode, Record<Speed, Quote> & { pooled: Quote }> // shipping and tax follow the selected address's country
  nileDay: number | null // the shopper's pooling weekday; null ships as ordered
  addresses: (Address & { oneLine: string })[]
  cards: (Card & { label: string; expiry: string })[]
  cod: { advanceRate: number; detail: string } // lib/cod.ts: the shopper's cash standing
  notices: string[]
}

const LEGAL = "By placing your order, you agree to nile's privacy notice and conditions of use."
const PLACING = 'nile:placing' // sessionStorage: token of the last checkout submitted in this tab
const ADDRESS_HEADING = '#address-heading'
const PAYMENT_HEADING = '#payment-heading'
const CASH = 'cod'
const CARD_NUMBER = 'section[aria-labelledby="payment-heading"] input[name="number"]'

export function Checkout({ token, buy, lines, linesKey, quotes, nileDay, addresses, cards, cod, notices }: Props) {
  const { currency, rate, country: regionCountry } = useRegion()
  // the shopper's picks live in the URL, so a trip to the cart (or a product page) and Back keeps them
  const params = useSearchParams()
  const choose = (key: 'address' | 'card' | 'speed', value: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set(key, value)
    window.history.replaceState(null, '', url)
  }
  const address = addresses.find((a) => a.id === params.get('address')) ?? addresses[0]
  const card = cards.find((c) => c.id === params.get('card') && !c.expired) ?? cards.find((c) => !c.expired)
  // cash rides in the same URL slot as the card, so Back keeps the choice like every other pick here
  const payCash = params.get('card') === CASH
  const advancePct = Math.round(cod.advanceRate * 100)
  const speed: Speed = params.get('speed') === 'expedited' ? 'expedited' : 'standard'

  const [addressView, setAddressView] = useState<View>('summary')
  const [cardView, setCardView] = useState<View>('summary')
  const [state, place, placing] = useActionState<PlaceOrderState, FormData>(placeOrder, null)
  const [editing, startEdit] = useTransition()
  const [editError, setEditError] = useState('')
  const [placedId, setPlacedId] = useState<string | null>(null)
  const focusNext = useRef<string | null>(null)
  const alertRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (state?.error) alertRef.current?.focus()
  }, [state])
  // after a section changes, move focus to it (or to the next step's first field) so keyboard and screen-reader users follow
  // (retried each render: a saved address or card shows up only once the refreshed props arrive)
  useEffect(() => {
    const target = focusNext.current && document.querySelector<HTMLElement>(focusNext.current)
    if (target) {
      target.focus()
      focusNext.current = null
    }
  })
  // Back from the thank-you page shows this page as it was; if its token already placed an order, say so instead
  useEffect(() => {
    let submitted = false
    try {
      submitted = sessionStorage.getItem(PLACING) === token
    } catch {}
    if (submitted) placedOrderId(token).then(setPlacedId, () => {})
  }, [token])

  const aView = addressView === 'summary' && !address ? 'new' : addressView
  // a first-time shopper adds the address first; payment opens once it is saved
  const cView = cardView === 'summary' && !card && !payCash ? (cards.length ? 'list' : address ? 'new' : 'locked') : cardView
  // before an address is saved, quote for the shopper's delivery country
  const country = address ? countryCodeFromName(address.country) : regionCountry
  // Your nile day is the stored weekday, so it is one bit: set means this standard order waits for it and is credited.
  // The pooled quote is always sent, on the shopper's day or the one we propose, so the option can show its real date.
  const pooling = nileDay !== null && speed === 'standard'
  const day = nileDay ?? DEFAULT_DAY
  const pooledQuote = quotes[country].pooled
  const q = pooling ? pooledQuote : quotes[country][speed]
  const summary = summaryRows({ ...q, items: lines.map((l) => ({ priceCents: toCents(l.price), quantity: l.quantity })), taxCents: q.taxLabel ? q.taxCents : null }, currency, rate)
  // pooled: everything waits for the one day, so the review section shows a single arrival
  const groups = pooling ? shipments(lines, () => pooledQuote.deliverBy) : shipments(lines, (l) => l.arrives[country][speed])
  const blocker = !address
    ? 'Add a delivery address to continue.'
    : payCash
      ? cod.advanceRate > 0 && !card
        ? `Add a card for the ${advancePct}% we take up front on cash orders.`
        : null
      : !card
        ? 'Add a payment method to continue.'
        : null
  const error = editError || state?.error
  const doneId = placedId ?? state?.orderId

  const submit = (form: FormData) => {
    try {
      sessionStorage.setItem(PLACING, token)
    } catch {}
    place(form)
  }
  const edit = (action: () => Promise<unknown>) =>
    startEdit(async () => {
      setEditError('')
      try {
        await action()
      } catch {
        setEditError('There was a problem updating your cart. Please try again.')
      }
    })
  // the stored day is the choice: setting it pools this order onto that weekday, clearing it ships as ordered
  const setDay = (d: number | null) => {
    const form = new FormData()
    form.set('day', d === null ? '' : String(d))
    edit(() => saveNileDay(form))
  }

  if (doneId) return <AlreadyPlaced orderId={doneId} />

  const placeButton = (className: string) => (
    <button type="submit" form="place-order" disabled={placing || editing || !!blocker} className={`btn btn-cart btn-lg ${className}`}>
      {placing ? 'Placing your order…' : 'Place your order'}
    </button>
  )

  return (
    <div className="mx-auto grid w-full max-w-[1150px] gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:py-6">
      <form id="place-order" action={submit} hidden>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="lines" value={linesKey} />
        {buy && <input type="hidden" name="buy" value={buy.id} />}
        {buy && <input type="hidden" name="qty" value={buy.qty} />}
        <input type="hidden" name="addressId" value={address?.id ?? ''} />
        <input type="hidden" name="cardId" value={card?.id ?? ''} />
        <input type="hidden" name="payment" value={payCash ? CASH : 'card'} />
        <input type="hidden" name="speed" value={speed} />
      </form>

      <div className="min-w-0 space-y-4">
        {error && (
          <div ref={alertRef} tabIndex={-1} role="alert" className="rounded-lg border border-[#cc0c39] bg-white px-4 py-3 shadow-[0_0_0_4px_#fcf4f4_inset] outline-none">
            <p className="font-bold text-[#cc0c39]">There was a problem</p>
            <p className="text-sm">{error}</p>
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
          <Section
            done
            headingId="address-heading"
            title={`Delivering to ${address.fullName}`}
            onChange={() => {
              setAddressView('list')
              focusNext.current = ADDRESS_HEADING
            }}
            changeLabel="Change delivery address"
          >
            <p className="text-sm">{address.oneLine}</p>
            {address.instructions && <p className="mt-1 text-xs text-muted">Delivery instructions: {address.instructions}</p>}
          </Section>
        ) : aView === 'list' ? (
          <Section headingId="address-heading" title="Select a delivery address">
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
              value={address?.id ?? ''}
              onChange={(id) => choose('address', id)}
            />
            <button
              type="button"
              onClick={() => {
                setAddressView('new')
                focusNext.current = 'section[aria-labelledby="address-heading"] input[name="fullName"]'
              }}
              className="link mt-3 block cursor-pointer text-sm"
            >
              + Add a new delivery address
            </button>
            <button
              type="button"
              onClick={() => {
                setAddressView('summary')
                focusNext.current = ADDRESS_HEADING
              }}
              disabled={!address}
              className="btn btn-cart mt-3"
            >
              Deliver to this address
            </button>
          </Section>
        ) : (
          <Section headingId="address-heading" title="Enter a new delivery address">
            <AddressForm
              submitLabel="Use this address"
              onSaved={(id) => {
                choose('address', id)
                setAddressView('summary')
                // first-time checkout goes straight on to the card form, with the name already filled in
                focusNext.current = card ? ADDRESS_HEADING : CARD_NUMBER
              }}
              onCancel={
                addresses.length
                  ? () => {
                      setAddressView('list')
                      focusNext.current = ADDRESS_HEADING
                    }
                  : undefined
              }
            />
          </Section>
        )}

        {cView === 'summary' && (payCash || card) ? (
          <Section
            done
            headingId="payment-heading"
            title={payCash ? 'Paying with Cash on Delivery' : `Paying with ${card!.label}`}
            onChange={() => {
              setCardView('list')
              focusNext.current = PAYMENT_HEADING
            }}
            changeLabel="Change payment method"
          >
            {payCash ? (
              <p className="text-sm text-muted">
                Pay the courier when it arrives.
                {cod.advanceRate > 0 && card && ` We take ${advancePct}% now on ${card.label}, the rest in cash.`}
              </p>
            ) : (
              <p className="text-sm text-muted">
                {card!.nameOnCard} · Expires {card!.expiry}
              </p>
            )}
          </Section>
        ) : cView === 'locked' ? (
          <Section headingId="payment-heading" title="Payment method" muted>
            <p className="text-sm text-muted">Save a delivery address first, then add your card.</p>
          </Section>
        ) : cView === 'list' ? (
          <Section headingId="payment-heading" title="Payment method">
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
              value={payCash ? CASH : (card?.id ?? '')}
              onChange={(id) => choose('card', id)}
            />
            {/* cash is what most shoppers here trust; the advance, when there is one, says why in plain words */}
            <h3 className="mt-4 mb-2 text-sm">Other ways to pay</h3>
            <Choices
              legend="Cash on delivery"
              options={[
                {
                  id: CASH,
                  label: (
                    <>
                      <b>Cash on Delivery</b>
                      <span className="block text-muted">Pay the courier when it arrives.</span>
                      {cod.advanceRate > 0 && <span className="block text-danger">{cod.detail}</span>}
                    </>
                  ),
                },
              ]}
              value={payCash ? CASH : ''}
              onChange={(id) => choose('card', id)}
            />
            <button
              type="button"
              onClick={() => {
                setCardView('new')
                focusNext.current = CARD_NUMBER
              }}
              className="link mt-3 block cursor-pointer text-sm"
            >
              + Add a credit or debit card
            </button>
            <button
              type="button"
              onClick={() => {
                setCardView('summary')
                focusNext.current = PAYMENT_HEADING
              }}
              disabled={!card && !payCash}
              className="btn btn-cart mt-3"
            >
              Use this payment method
            </button>
          </Section>
        ) : (
          <Section headingId="payment-heading" title="Add a credit or debit card">
            <CardForm
              defaultName={address?.fullName}
              onSaved={(id) => {
                choose('card', id)
                setCardView('summary')
                focusNext.current = PAYMENT_HEADING
              }}
              onCancel={
                cards.length
                  ? () => {
                      setCardView('list')
                      focusNext.current = PAYMENT_HEADING
                    }
                  : undefined
              }
            />
            {/* a first-time shopper lands straight on this form, so cash has to be reachable from here too, and a shopper
                who now owes an advance is told why a card is being asked for at all */}
            {!cards.length && cod.advanceRate > 0 && <p className="mt-4 text-sm text-danger">{cod.detail}</p>}
            {!cards.length && (
              <button
                type="button"
                onClick={() => {
                  choose('card', CASH)
                  setCardView('summary')
                  focusNext.current = PAYMENT_HEADING
                }}
                className="link mt-4 block cursor-pointer text-sm"
              >
                Pay with Cash on Delivery instead
              </button>
            )}
          </Section>
        )}

        <section aria-label="Review items and delivery" aria-busy={editing} className={`rounded-lg border border-line bg-white p-4 transition-opacity sm:p-5 ${editing ? 'opacity-60' : ''}`}>
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
            <div className="space-y-5">
              {groups.map((g, i) => (
                <div key={g.date.getTime()}>
                  <h2 className="text-lg leading-6 text-success">Arriving {longDate(g.date)}</h2>
                  <p className="text-xs text-muted">
                    {[
                      groups.length > 1 && `Shipment ${i + 1} of ${groups.length}`,
                      i === 0 && (buy ? 'Buying now: the items in your cart are not affected.' : `${plural(q.itemCount, 'item')} from your cart`),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <ul className="mt-3 space-y-3">
                    {g.items.map((l) => (
                      <ReviewLine key={l.id} line={l} editable={!buy} onEdit={edit} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <fieldset className="self-start">
              <legend className="mb-1 text-sm font-bold">Choose your delivery option:</legend>
              {(['standard', 'expedited'] as const).map((s) => {
                const o = quotes[country][s]
                const price = o.freeShippingCents ? 'FREE' : formatMoney(o.shippingCents, currency, rate)
                const split = shipments(lines, (l) => l.arrives[country][s]).length > 1
                return (
                  <label key={s} className="flex cursor-pointer gap-2 rounded-md p-1.5 text-sm has-[:checked]:bg-[#f0f8f9]">
                    <input
                      type="radio"
                      name="delivery-speed"
                      checked={speed === s && !pooling}
                      onChange={() => {
                        choose('speed', s)
                        if (pooling) setDay(null) // leaving the pooled option turns the nile day off
                      }}
                      className="mt-0.5 size-4 shrink-0 accent-link"
                    />
                    <span>
                      <b className="text-success">
                        {split && 'All by '}
                        {longDate(o.deliverBy)}
                      </b>
                      <span className="block">
                        {price} {deliveryName(s, country)}
                        <span className="text-xs text-muted"> · {s === 'standard' ? 'Cheapest' : 'Fastest'}</span>
                      </span>
                    </span>
                  </label>
                )
              })}
              {/* Your nile day: the week's orders arrive in one trip, and the shipping that saves comes back. The date and
                  the saving are both on the label, so nothing is ever delayed without the shopper seeing what for. */}
              <div className="rounded-md p-1.5 has-[:checked]:bg-[#f0f8f9]">
                <label className="flex cursor-pointer gap-2 text-sm">
                  <input
                    type="radio"
                    name="delivery-speed"
                    checked={pooling}
                    onChange={() => {
                      choose('speed', 'standard')
                      setDay(day)
                    }}
                    className="mt-0.5 size-4 shrink-0 accent-link"
                  />
                  <span>
                    <b className="text-success">{longDate(pooledQuote.deliverBy)}</b>
                    <span className="block">
                      With the rest of your week
                      {pooledQuote.creditCents > 0 && <> · you save {formatMoney(pooledQuote.creditCents, currency, rate)}</>}
                    </span>
                  </span>
                </label>
                {/* the select is a sibling, not inside the label: it would otherwise land in the radio's spoken name */}
                <span className="mt-1 flex flex-wrap items-center gap-1 pl-6 text-xs text-muted">
                  Your nile day:
                  <select value={day} onChange={(e) => setDay(Number(e.target.value))} aria-label="Your nile day" className="select-pill">
                    {DAY_NAMES.map((name, i) => (
                      <option key={name} value={i}>{name}</option>
                    ))}
                  </select>
                </span>
              </div>
            </fieldset>
          </div>
        </section>

        <section aria-label="Place your order" className="hidden items-center gap-3 rounded-lg border border-line bg-white p-5 lg:flex">
          {placeButton('px-8')}
          <div>
            <p className="text-lg font-bold text-danger">Order total: {summary.total}</p>
            <p className="text-xs">{blocker ? <span className="text-danger">{blocker}</span> : LEGAL}</p>
          </div>
        </section>
        <p className="px-1 text-xs text-muted">
          When you place your order you&apos;ll see a confirmation right away. This is a demo store: nothing is charged and nothing ships.
        </p>
      </div>

      <aside aria-label="Order summary" className="self-start lg:sticky lg:top-4">
        <div className="rounded-lg border border-line bg-white p-4">
          <div className="hidden lg:block">
            {placeButton('w-full')}
            <p className="mt-2 text-center text-xs">{LEGAL}</p>
            {blocker && <p className="mt-1 text-center text-xs text-danger">{blocker}</p>}
            <hr className="my-3 border-line" />
          </div>
          <h2 className="mb-2 text-lg leading-6">Order Summary</h2>
          <dl className="space-y-1 text-[13px]">
            {summary.rows.map((r) => (
              <Row key={r.label} label={r.label} value={r.text} />
            ))}
            <Row label="Order total:" value={summary.total} total />
          </dl>
          <p className="mt-3 text-xs text-muted">{summary.note ?? `Estimated tax is a flat ${(q.taxRate * 100).toFixed(2)}% of items and shipping.`}</p>
          <p className="mt-2 text-xs lg:hidden">{blocker ? <span className="text-danger">{blocker}</span> : LEGAL}</p>
        </div>
      </aside>

      {/* phones and tablets: one Place your order, always in reach, once there is nothing left to fill in */}
      {!blocker && (
        <div className="sticky bottom-0 z-10 -mx-3 -mb-4 flex items-center gap-3 border-t border-line bg-white px-3 py-2.5 shadow-[0_-2px_8px_rgba(15,17,17,0.1)] sm:-mx-4 sm:px-4 lg:hidden">
          <p className="min-w-0 flex-1 text-xs">
            Order total
            <b className="block text-lg leading-6 text-danger">{summary.total}</b>
          </p>
          {placeButton('px-6')}
        </div>
      )}
    </div>
  )
}

function ReviewLine({ line: l, editable, onEdit }: { line: Line; editable: boolean; onEdit: (action: () => Promise<unknown>) => void }) {
  const { currency, rate } = useRegion()
  const fields = (quantity: string | number) => {
    const f = new FormData()
    f.set('productId', String(l.id))
    f.set('quantity', String(quantity))
    return f
  }
  return (
    <li className="flex gap-3">
      <Link href={`/dp/${l.id}`} aria-hidden tabIndex={-1} className="flex size-20 shrink-0 items-center justify-center rounded-sm bg-[#f7f7f7] p-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={l.thumbnail} alt="" className="max-h-full max-w-full object-contain mix-blend-multiply" />
      </Link>
      <div className="min-w-0 text-sm">
        <Link href={`/dp/${l.id}`} className="line-clamp-2 font-bold hover:text-link-hover hover:underline">{l.title}</Link>
        <p className="font-bold text-danger">{formatDollars(l.price, currency, rate)}</p>
        {editable ? (
          <div className="mt-1 flex items-center gap-3">
            {/* keyed by the saved quantity: it resets to the server's value after each change */}
            <select
              key={l.quantity}
              defaultValue={l.quantity}
              onChange={(e) => onEdit(() => updateQuantity(fields(e.target.value)))}
              aria-label={`Quantity of ${l.title}`}
              className="select-pill text-[13px]"
            >
              {Array.from({ length: Math.max(l.max, l.quantity) }, (_, i) => (
                <option key={i} value={i + 1}>Qty: {i + 1}</option>
              ))}
            </select>
            <button type="button" onClick={() => onEdit(() => removeFromCart(fields(0)))} aria-label={`Delete ${l.title}`} className="link cursor-pointer text-[13px]">
              Delete
            </button>
          </div>
        ) : (
          <p>Qty: {l.quantity}</p>
        )}
        {l.stock < 10 && <p className="text-xs text-danger">Only {l.stock} left in stock - order soon.</p>}
      </div>
    </li>
  )
}

function AlreadyPlaced({ orderId }: { orderId: string }) {
  return (
    <div className="mx-auto w-full max-w-[600px] px-4 py-10">
      <div role="status" className="rounded-lg border border-line bg-white p-6 text-center">
        <CheckCircleIcon className="mx-auto size-8 text-success" />
        <h2 className="mt-2 text-xl">You already placed this order</h2>
        <p className="mt-1 text-sm text-muted">Order # {orderId}. To buy more, add items to your cart and check out again.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href={`/thankyou/${orderId}`} className="btn btn-cart">View your order</Link>
          <Link href="/cart" className="btn btn-plain">Go to Cart</Link>
        </div>
      </div>
    </div>
  )
}

function Section({ headingId, title, done, muted, onChange, changeLabel, children }: { headingId: string; title: string; done?: boolean; muted?: boolean; onChange?: () => void; changeLabel?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={headingId} className="rounded-lg border border-line bg-white p-4 sm:p-5">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h2 id={headingId} tabIndex={-1} className={`flex items-center gap-2 text-lg leading-6 outline-none ${muted ? 'text-muted' : ''}`}>
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
      <dt className="min-w-0">{label}</dt>
      <dd className="whitespace-nowrap">{value}</dd>
    </div>
  )
}
