import type { Metadata } from 'next'
import Link from 'next/link'
import { makeDefaultCard, removeWalletCard } from '@/app/actions/account'
import { ConfirmDialog } from '@/components/account/modal'
import { alertFrom, Crumbs, Notice } from '@/components/account/ui'
import { CardForm } from '@/components/card-form'
import { CloseIcon } from '@/components/icons'
import { requireUser } from '@/lib/auth'
import { cardExpiry, cardLabel, getCards } from '@/lib/payments'

export const metadata: Metadata = { title: 'Your Payments' }

const ALERTS = { added: 'Card added', default: 'Default payment method changed', removed: 'Card removed' }

const ART: Record<string, [string, string]> = {
  Visa: ['#1a1f71', 'VISA'],
  Mastercard: ['#eb001b', 'MC'],
  'American Express': ['#2e77bc', 'AMEX'],
  Discover: ['#e55c20', 'DISC'],
}

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser('/account/payments')
  const [cards, { alert, add }] = await Promise.all([getCards(user.id), searchParams])
  const notice = alertFrom(ALERTS, alert)
  const adding = add === '1'

  return (
    <div className="mx-auto max-w-[800px] px-4 py-10">
      <Crumbs trail={[['Your Account', '/account'], ['Your Payments']]} />
      <h1 className="mb-6 text-[28px] leading-9">Your Payments</h1>
      {notice && <Notice>{notice}</Notice>}

      <section aria-labelledby="wallet-title" className="card">
        <h2 id="wallet-title" className="border-b border-line px-5 py-4 text-lg">Cards &amp; accounts</h2>

        {cards.length === 0 && !adding && (
          <div className="px-5 py-14 text-center">
            <p className="text-muted">You don&apos;t have any payment methods saved.</p>
            <Link href="/account/payments?add=1" scroll={false} className="btn btn-cart mt-5">Add a payment method</Link>
            <p className="mt-3 text-xs text-muted">Demo store: nothing is charged.</p>
          </div>
        )}

        {cards.length > 0 && (
          <ul>
            {cards.map((c) => {
              const [color, short] = ART[c.brand] ?? ['#565959', c.brand.slice(0, 4).toUpperCase()]
              return (
                <li key={c.id} aria-label={cardLabel(c)} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-4 last:border-b-0">
                  <span aria-hidden style={{ background: color }} className="flex h-8 w-12 shrink-0 items-center justify-center rounded-[4px] text-[10px] font-semibold tracking-wide text-white">
                    {short}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {c.brand} <span className="price font-normal text-muted">•••• {c.last4}</span>
                    </p>
                    <p className="text-xs break-words text-muted">
                      {c.nameOnCard} · Expires {cardExpiry(c)}
                    </p>
                  </div>
                  {c.isDefault && <span className="rounded-full border border-line px-2 py-0.5 text-xs text-accent">Default</span>}
                  {c.expired && <span className="text-xs font-medium text-deal">Expired</span>}
                  <div className="flex items-center gap-3 text-sm">
                    {!c.isDefault && !c.expired && (
                      <form action={makeDefaultCard}>
                        <input type="hidden" name="id" value={c.id} />
                        <button type="submit" aria-label={`Set ${cardLabel(c)} as default`} className="link cursor-pointer">Set as default</button>
                      </form>
                    )}
                    <ConfirmDialog
                      label="Remove"
                      ariaLabel={`Remove ${cardLabel(c)}`}
                      title="Remove card"
                      action={removeWalletCard}
                      fields={{ id: c.id }}
                      confirm="Confirm Remove"
                      cancel="Cancel"
                    >
                      <p>
                        Remove <b className="font-medium">{cardLabel(c)}</b> from your wallet?
                      </p>
                      <p className="mt-1 text-muted">Orders you already placed with it aren&apos;t affected.</p>
                    </ConfirmDialog>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {adding ? (
          <div className="px-5 py-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg">Add a credit or debit card</h2>
              <Link href="/account/payments" aria-label="Close" scroll={false} className="flex size-9 items-center justify-center rounded-md hover:bg-page">
                <CloseIcon className="size-4" />
              </Link>
            </div>
            <CardForm returnTo="/account/payments?alert=added" />
          </div>
        ) : (
          cards.length > 0 && (
            <div className="border-t border-line px-5 py-4">
              <Link href="/account/payments?add=1" scroll={false} className="link text-sm">+ Add a credit or debit card</Link>
            </div>
          )
        )}
      </section>
    </div>
  )
}
