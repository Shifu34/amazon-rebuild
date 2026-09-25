import type { Metadata } from 'next'
import Link from 'next/link'
import { signOut } from '@/app/actions/auth'
import { demoSendReminders } from '@/app/actions/reminders'
import { ReminderList } from '@/components/orders/reminder'
import { getAddresses } from '@/lib/addresses'
import { requireUser } from '@/lib/auth'
import { one } from '@/lib/db'
import { plural } from '@/lib/format'
import { historyPaused } from '@/lib/history'
import { getLists } from '@/lib/lists'
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
  const [addresses, cards, lists, viewed, paused, reminders, sp] = await Promise.all([
    getAddresses(user.id),
    getCards(user.id),
    getLists(user.id),
    one<{ n: number }>('select count(*)::int as n from browsing_history where user_id = $1', [user.id]),
    historyPaused(user.id),
    getReminders(user.id),
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
    <div className="mx-auto max-w-[1000px] px-4 py-6">
      <h1 className="text-[28px] leading-9 font-normal">Your Account</h1>
      <p className="mt-1 text-sm break-words">
        Signed in as <b>{user.name}</b> ({user.email})
      </p>

      <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <li key={t.href}>
            <Link href={t.href} className="flex h-full items-start gap-4 rounded-lg border border-line p-4 hover:bg-[#f7fafa] focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none">
              <svg viewBox="0 0 24 24" className="size-12 shrink-0 text-[#4c8da3]" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={t.icon} />
              </svg>
              <span className="min-w-0">
                <span className="block text-[17px] leading-6 font-bold">{t.title}</span>
                <span className="block text-sm break-words text-muted">{t.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {stopped && (
        <p role="status" className="mt-5 rounded-lg border border-line bg-[#f7f8f8] p-3 text-sm">
          Stopped. We won&apos;t remind you about {stopped} again.
        </p>
      )}

      <div className="mt-5">
        <ReminderList
          reminders={reminders}
          demo={
            <form action={demoSendReminders} className="mt-3 rounded-lg border-2 border-dashed border-[#c7c7c7] p-3">
              <button type="submit" className="btn btn-plain">Demo: send due reminders now</button>
              <p className="mt-1 text-xs text-muted">Reminders are weeks away, so this brings yours forward and emails them now.</p>
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
