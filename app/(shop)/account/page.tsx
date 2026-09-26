import type { Metadata } from 'next'
import Link from 'next/link'
import { signOut } from '@/app/actions/auth'
import { demoSendReminders } from '@/app/actions/reminders'
import { NileDay } from '@/components/account/nile-day'
import { ReminderList } from '@/components/orders/reminder'
import { getAddresses } from '@/lib/addresses'
import { requireUser } from '@/lib/auth'
import { one } from '@/lib/db'
import { plural } from '@/lib/format'
import { historyPaused } from '@/lib/history'
import { getLists } from '@/lib/lists'
import { codStanding } from '@/lib/cod'
import { getNileDay } from '@/lib/nile-day'
import { cardLabel, getCards } from '@/lib/payments'
import { getReminders } from '@/lib/reminders'

export const metadata: Metadata = { title: 'Your Account' }

// 24px line icons, one path each
const ICON = {
  orders: 'M3 7.5 12 3l9 4.5v9L12 21l-9-4.5zM3 7.5l9 4.5 9-4.5M12 12v9M7.5 5.2l9 4.6',
  security: 'M7 10V7.5a5 5 0 0 1 10 0V10M5 10h14v11H5zM12 14.5v2.5',
  addresses: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  payments: 'M2.5 5.5h19v13h-19zM2.5 9.5h19M6 15h4',
  lists: 'M9 6h12M9 12h12M9 18h12M4 6h.5M4 12h.5M4 18h.5',
  history: 'M12 21a9 9 0 1 0-9-9M3 12v-4M3 12h4M12 7v5l3.5 2',
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser('/account')
  const [addresses, cards, lists, viewed, paused, reminders, nileDay, cod, sp] = await Promise.all([
    getAddresses(user.id),
    getCards(user.id),
    getLists(user.id),
    one<{ n: number }>('select count(*)::int as n from browsing_history where user_id = $1', [user.id]),
    historyPaused(user.id),
    getReminders(user.id),
    getNileDay(user.id),
    codStanding(user.id),
    searchParams,
  ])
  // the email's one-click stop lands back here (app/api/reminders/stop)
  const stopped = sp.reminder === 'stopped' ? String(sp.title ?? 'That item') : null
  const address = addresses[0] // default first
  const card = cards[0]
  const listItems = lists.reduce((n, l) => n + l.itemCount, 0)
  const views = viewed?.n ?? 0

  const tiles: { href: string; title: string; text: string; icon: string }[] = [
    { href: '/orders', title: 'Your Orders', text: 'Track, return, cancel an order, or buy again', icon: ICON.orders },
    { href: '/account/security', title: 'Login & security', text: 'Edit name, email and password', icon: ICON.security },
    {
      href: '/account/addresses',
      title: 'Your Addresses',
      text: address ? `${address.isDefault ? 'Default: ' : ''}${address.line1}, ${address.city}` : 'Add a delivery address',
      icon: ICON.addresses,
    },
    {
      href: '/account/payments',
      title: 'Your Payments',
      text: card ? `${cardLabel(card)}${card.isDefault ? ' (default)' : ''}` : 'Add a credit or debit card',
      icon: ICON.payments,
    },
    {
      href: '/lists',
      title: 'Your Lists',
      text: lists.length ? `${plural(lists.length, 'list')} · ${plural(listItems, 'item')}` : 'Save items to shop for later',
      icon: ICON.lists,
    },
    {
      href: '/history',
      title: 'Browsing History',
      text: paused ? 'Turned off' : views ? `${plural(views, 'item')} viewed recently` : "Items you've viewed",
      icon: ICON.history,
    },
  ]

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-10">
      <h1 className="text-[28px] leading-9">Your Account</h1>
      <p className="mt-1 text-sm break-words text-muted">
        Signed in as <b className="font-medium text-ink">{user.name}</b> ({user.email})
      </p>

      {/* an index, not a wall of boxes: a rule over each entry, the accent only on the marks you can follow */}
      <ul className="mt-8 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <li key={t.href} className="border-t border-line">
            <Link href={t.href} className="group flex h-full items-start gap-4 py-5 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none">
              <svg viewBox="0 0 24 24" className="mt-0.5 size-8 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={t.icon} />
              </svg>
              <span className="min-w-0">
                <span className="block font-display text-lg leading-6 font-semibold group-hover:underline">{t.title}</span>
                <span className="mt-0.5 block text-sm break-words text-muted">{t.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {stopped && (
        <p role="status" className="mt-8 rounded-lg border border-line bg-accent-soft px-4 py-3 text-sm">
          Stopped. We won&apos;t remind you about {stopped} again.
        </p>
      )}

      <div className="mt-10 border-t border-line pt-8">
        <NileDay day={nileDay} />
      </div>

      {/* cash standing in plain words: what it costs them today and how it changes (lib/cod.ts) */}
      <section aria-labelledby="cod-standing" className="mt-10 border-t border-line pt-8">
        <h2 id="cod-standing" className="text-lg">{cod.headline}</h2>
        <p className="mt-1 max-w-[70ch] text-sm text-muted">{cod.detail}</p>
      </section>

      <div className="mt-10 border-t border-line pt-8">
        <ReminderList
          reminders={reminders}
          demo={
            <form action={demoSendReminders} className="mt-4 rounded-[10px] border border-dashed border-line p-4">
              <button type="submit" className="btn btn-plain">Demo: send due reminders now</button>
              <p className="mt-2 text-xs text-muted">Reminders are weeks away, so this brings yours forward and emails them now.</p>
            </form>
          }
        />
      </div>

      <form action={signOut} className="mt-8 border-t border-line pt-6">
        <button type="submit" className="btn btn-plain btn-lg">Sign Out</button>
      </form>
    </div>
  )
}
