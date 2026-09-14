import Link from 'next/link'
import { cookies, headers } from 'next/headers'
import { Suspense } from 'react'
import { signOut } from '@/app/actions/auth'
import { getUser } from '@/lib/auth'
import { cartCount } from '@/lib/cart'
import { CATEGORY_NAMES, DEPARTMENTS } from '@/lib/catalog'
import { one } from '@/lib/db'
import { CartIcon, Logo, PinIcon } from './icons'
import { LocaleMenu } from './locale-menu'
import { Flyout, LocationPicker, NavDrawer } from './nav-drawer'
import { SearchBar } from './search-bar'

const departments = DEPARTMENTS.map((d) => ({ ...d, categories: d.categories.map((slug) => ({ slug, name: CATEGORY_NAMES[slug] })) }))
const regionName = new Intl.DisplayNames(['en'], { type: 'region' })

async function deliverTo(userId: string | undefined): Promise<{ label: string; place: string; zip?: string }> {
  if (userId) {
    const a = await one<{ full_name: string; city: string; zip: string }>(
      'select full_name, city, zip from addresses where user_id = $1 order by is_default desc, created_at desc limit 1',
      [userId],
    )
    if (a) return { label: `Deliver to ${a.full_name.split(' ')[0]}`, place: `${a.city} ${a.zip}` }
  }
  // set by the location dialog; the browser writes this cookie, so check it here
  const zip = (await cookies()).get('zip')?.value
  if (zip && /^\d{5}$/.test(zip)) return { label: 'Delivering to', place: zip, zip }
  const h = await headers()
  const country = h.get('x-vercel-ip-country')?.toUpperCase()
  if (country && country !== 'US' && /^[A-Z]{2}$/.test(country)) return { label: 'Deliver to', place: regionName.of(country) ?? country }
  const city = h.get('x-vercel-ip-city')
  return city
    ? { label: 'Delivering to', place: `${decodeURIComponent(city)} ${h.get('x-vercel-ip-postal-code') ?? ''}`.trim() }
    : { label: 'Deliver to', place: 'United States' }
}

// two-line items in the top bar ("Hello, sign in / Account & Lists"): 50px tall boxes that outline white on hover
const item = 'nav-item md:flex md:h-[50px] md:flex-col md:justify-center md:px-[9px] md:py-0'
const line1 = 'block text-xs leading-[14px] whitespace-nowrap'
const line2 = 'block text-sm leading-[15px] font-bold whitespace-nowrap'

export async function Header() {
  const user = await getUser()
  const [count, location] = await Promise.all([cartCount(), deliverTo(user?.id)])
  const firstName = user ? user.name.split(' ')[0] : null
  // signed in: the address book; guests: a dialog to sign in or enter a ZIP
  const deliver = (className: string, children: React.ReactNode) =>
    user ? (
      <Link href="/account/addresses" className={className}>{children}</Link>
    ) : (
      <LocationPicker zip={location.zip} className={`cursor-pointer text-left ${className}`}>{children}</LocationPicker>
    )
  const shortcuts: [string, string][] = [
    ["Today's Deals", '/deals'],
    ...(user ? [['Buy Again', '/orders?tab=buy-again'] as [string, string]] : []),
    ['Best Sellers', '/bestsellers'],
    ['New Releases', '/s?sort=newest'],
    ['Customer Service', '/help'],
    ...(user ? [['Browsing History', '/history'] as [string, string]] : []),
  ]
  const menuLink = 'hover:text-link-hover hover:underline'

  return (
    // a stacking context, so the flyouts' dimmer sits under both bars and over the page
    <header className="relative z-50 text-white">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-2 bg-nav px-2 py-2 md:h-[60px] md:flex-nowrap md:gap-x-0 md:py-0">
        <NavDrawer departments={departments} userName={firstName} variant="icon" />
        <Link href="/" aria-label="nile home" className="nav-item px-2 pt-2 pb-1 md:flex md:h-[50px] md:items-center md:px-[9px] md:pt-1 md:pb-0">
          <Logo className="text-[26px] md:text-[31px]" />
        </Link>
        {deliver(
          'nav-item hidden h-[50px] items-center gap-0.5 pr-[9px] pl-[7px] lg:flex',
          <>
            <PinIcon className="mt-2.5 size-[17px] shrink-0" />
            <span>
              <span className={`${line1} text-[#ccc]`}>{location.label}</span>
              <span className={`${line2} max-w-[150px] truncate`} title={location.place}>{location.place}</span>
            </span>
          </>,
        )}

        <Suspense fallback={<div className="order-last h-10 w-full rounded-md bg-white md:order-none md:mx-3.5 md:flex-1 md:rounded" />}>
          <SearchBar departments={departments.map(({ slug, name }) => ({ slug, name }))} />
        </Suspense>

        <div className="ml-auto flex items-center md:ml-0">
          <Link href={user ? '/account' : '/ap/signin'} className="nav-item px-2 py-2 text-sm md:hidden">
            {firstName ? `${firstName} ›` : 'Sign in ›'}
          </Link>

          <LocaleMenu />

          <Flyout
            href={user ? '/account' : '/ap/signin'}
            className="hidden md:block"
            toggleLabel="Account & Lists menu"
            label={
              <>
                <span className={line1}>Hello, {firstName ?? 'sign in'}</span>
                <span className={line2}>Account &amp; Lists</span>
              </>
            }
            panelClassName="-right-[107px] w-[500px] pt-0.5"
          >
            <span aria-hidden className="absolute top-0 right-[108px] size-2.5 rotate-45 bg-white" />
            <div className="relative rounded-[3px] border border-[#d5d9d9] bg-white px-6 pt-3.5 pb-3 text-ink shadow-[0_2px_10px_rgba(0,0,0,0.25)]">
              {!user && (
                <div className="mb-3 border-b border-[#eee] pb-2 text-center">
                  <Link href="/ap/signin" className="btn btn-cart min-h-[33px] w-[220px] rounded-lg">Sign in</Link>
                  <p className="mt-1.5 text-xs leading-4">
                    New customer?{' '}
                    <Link href="/ap/register" className="text-[#0066c0] underline hover:text-link-hover">Start here.</Link>
                  </p>
                </div>
              )}
              <div className="flex text-[13px] leading-[23px] text-[#444]">
                <div className="w-[231px] shrink-0 pr-4">
                  <h2 className="mb-1 text-base leading-6 text-ink">Your Lists</h2>
                  <ul>
                    <li><Link href="/lists?create=1" className={menuLink}>Create a List</Link></li>
                    <li><Link href="/lists" className={menuLink}>Shopping List</Link></li>
                  </ul>
                </div>
                <div className="flex-1 border-l border-[#eee] pl-[21px]">
                  <h2 className="mb-1 text-base leading-6 text-ink">Your Account</h2>
                  <ul>
                    <li><Link href="/account" className={menuLink}>Account</Link></li>
                    <li><Link href="/orders" className={menuLink}>Orders</Link></li>
                    <li><Link href="/orders?tab=buy-again" className={menuLink}>Buy Again</Link></li>
                    <li><Link href="/history" className={menuLink}>Browsing History</Link></li>
                    <li><Link href="/account/addresses" className={menuLink}>Addresses</Link></li>
                    <li><Link href="/account/payments" className={menuLink}>Payments</Link></li>
                    {user && (
                      <li>
                        <form action={signOut}>
                          <button type="submit" className={`cursor-pointer ${menuLink}`}>Sign Out</button>
                        </form>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </Flyout>

          <Link href="/orders" className={`${item} hidden`}>
            <span className={line1}>Returns</span>
            <span className={line2}>&amp; Orders</span>
          </Link>

          <Link href="/cart" className="nav-item flex items-end px-2 py-1.5 md:h-[50px] md:px-[9px] md:pt-0 md:pb-[7px]" aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`}>
            <span className="relative">
              <CartIcon className="h-8 w-10" />
              {/* centered over the basket at any width: 1, 12 or 99+ */}
              <span className={`absolute -top-1 left-[27px] -translate-x-1/2 leading-5 font-bold text-brand md:left-[24px] ${count > 99 ? 'text-sm' : 'text-base'}`}>{count > 99 ? '99+' : count}</span>
            </span>
            <span className="mb-[3px] hidden text-sm leading-4 font-bold md:inline">Cart</span>
          </Link>
        </div>
      </div>

      <nav aria-label="Shortcuts" className="flex h-[39px] items-center gap-0.5 overflow-x-auto bg-nav-light px-2 text-sm whitespace-nowrap">
        <NavDrawer departments={departments} userName={firstName} variant="all" />
        {shortcuts.map(([label, href]) => (
          <Link key={href} href={href} className="nav-item px-2 py-1.5">{label}</Link>
        ))}
      </nav>

      {deliver(
        'flex w-full items-center gap-1.5 bg-nav-lighter px-3 py-2 text-[13px] lg:hidden',
        <>
          <PinIcon className="size-4" /> {location.label} {location.place}
        </>,
      )}
    </header>
  )
}
