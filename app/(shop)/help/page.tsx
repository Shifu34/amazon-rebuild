import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronIcon } from '@/components/icons'
import { PK_EXPEDITED_SHIPPING, PK_STANDARD_SHIPPING } from '@/lib/delivery'
import { formatDollars, formatMoney, IMPORT_FEES_NOTE } from '@/lib/region'

export const metadata: Metadata = { title: 'Customer Service' }

// a fee in both currencies, so the answer reads the same whichever one is shown
const both = (usd: number) => `${formatDollars(usd)} (${formatDollars(usd, 'PKR')})`

// Every tile opens a real page; the account pages send signed-out visitors through sign-in and back.
const TILES: { href: string; title: string; text: string; icon: string }[] = [
  { href: '/orders', title: 'Your Orders', text: 'Track packages, edit or cancel orders', icon: 'M3 7.5 12 3l9 4.5v9L12 21l-9-4.5zM3 7.5l9 4.5 9-4.5M12 12v9M7.5 5.2l9 4.6' },
  { href: '/orders', title: 'Returns & Refunds', text: 'Return items and follow your refund', icon: 'M4 9h11a5 5 0 0 1 0 10H9M4 9l4-4M4 9l4 4' },
  { href: '/account/addresses', title: 'Manage Addresses', text: 'Add, edit or set a default delivery address', icon: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z' },
  { href: '/account/payments', title: 'Payment Settings', text: 'Add or remove cards, choose your default', icon: 'M2.5 5.5h19v13h-19zM2.5 9.5h19M6 15h4' },
  { href: '/account/security', title: 'Account Settings', text: 'Change your name, email or password', icon: 'M7 10V7.5a5 5 0 0 1 10 0V10M5 10h14v11H5zM12 14.5v2.5' },
  { href: '/lists', title: 'Your Lists', text: 'Create lists and move items to your cart', icon: 'M9 6h12M9 12h12M9 18h12M4 6h.5M4 12h.5M4 18h.5' },
]

const mono = 'font-mono whitespace-nowrap'

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: 'Is nile a real store?',
    a: 'No. nile is a working rebuild of a big online store, made as a demo. Orders, payments and deliveries are simulated: nothing is charged, shipped or delivered.',
  },
  {
    q: 'Which cards can I pay with?',
    a: (
      <>
        Only test cards, so nobody types in a real one. Use <span className={mono}>4242 4242 4242 4242</span> with any future expiry date and any
        3-digit security code. Mastercard <span className={mono}>5555 5555 5555 4444</span> and Discover <span className={mono}>6011 1111 1111 1117</span> work
        too, and <span className={mono}>4000 0000 0000 0002</span> is declined at checkout so you can see what happens. Only the brand, last 4 digits and
        expiry are stored.
      </>
    ),
  },
  {
    q: 'Can I look around without making an account?',
    a: (
      <>
        Yes. On the <Link href="/ap/signin" className="link underline">sign-in page</Link>, choose <b>Explore with a demo account</b>. It signs you in as a
        fresh sample shopper with orders in every state, a saved address and test card, and a Shopping List.
      </>
    ),
  },
  {
    q: 'How does delivery work?',
    a: 'Each order moves from Ordered to Shipped, Out for delivery and Delivered along its delivery estimate. You can cancel it until it ships and return items for 30 days after delivery. To skip the wait, open the order and choose "Demo: mark as delivered"; after you return an item, "Demo: receive returned item" issues the refund.',
  },
  {
    q: 'Do you deliver to Pakistan, and can I see prices in Pakistani Rupees?',
    a: (
      <>
        Yes. Add a Pakistani address in <Link href="/account/addresses" className="link underline">Your Addresses</Link> and make it your default,
        or, without signing in, choose <b>Deliver to</b> at the top of the page and pick Pakistan under &quot;or ship outside the US&quot;. Standard
        delivery to Pakistan arrives about 8 business days later than in the US for a flat {both(PK_STANDARD_SHIPPING)}, and Expedited about 4
        business days later than US Expedited for {both(PK_EXPEDITED_SHIPPING)}. There is no free shipping and no US sales tax on these
        orders. {IMPORT_FEES_NOTE} Prices show in rupees while you deliver to Pakistan; to switch between PKR and US dollars, open the <b>EN</b> menu
        (on a phone, the menu under <b>All</b>). Rupee prices use a fixed rate of 1 USD = {formatMoney(100, 'PKR')}, and every order keeps the
        currency it was placed in.
      </>
    ),
  },
]

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6">
      <h1 className="text-[28px] leading-9 font-normal">Hello. What can we help you with?</h1>

      <h2 className="mt-6 text-lg">Some things you can do here</h2>
      <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((t) => (
          <li key={t.title}>
            <Link href={t.href} className="flex h-full items-center gap-4 rounded-lg border border-line p-4 hover:bg-[#f7fafa] focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none">
              <svg viewBox="0 0 24 24" className="size-12 shrink-0 text-[#4c8da3]" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={t.icon} />
              </svg>
              <span className="min-w-0">
                <span className="block text-[17px] leading-6 font-bold">{t.title}</span>
                <span className="block text-sm text-muted">{t.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <section aria-labelledby="faq" className="mt-10">
        <h2 id="faq" className="text-lg">About this demo store</h2>
        <div className="mt-3 divide-y divide-line border-y border-line">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 font-bold hover:text-link-hover [&::-webkit-details-marker]:hidden">
                {q}
                <ChevronIcon className="size-4 shrink-0 text-muted transition group-open:rotate-90" />
              </summary>
              <p className="max-w-3xl pb-4 text-sm">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
