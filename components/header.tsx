import Link from 'next/link'
import { cookies, headers } from 'next/headers'
import { Suspense } from 'react'
import { signOut } from '@/app/actions/auth'
import { dataSaver, setDataSaver } from '@/app/actions/data-saver'
import { DataSaverPrompt } from './data-saver'
import { getUser } from '@/lib/auth'
import { cartCount } from '@/lib/cart'
import { CATEGORY_NAMES, DEPARTMENTS } from '@/lib/catalog'
import { getRegion } from '@/lib/region-server'
import { BagIcon, PinIcon } from './icons'
import { LocaleMenu } from './locale-menu'
import { Flyout, LocationPicker, NavDrawer } from './nav-drawer'
import { SearchBar } from './search-bar'

const departments = DEPARTMENTS.map((d) => ({ ...d, categories: d.categories.map((slug) => ({ slug, name: CATEGORY_NAMES[slug] })) }))

// the same order as getRegion(): the default address, then the guest's choice (Pakistan or a US ZIP), then the IP
async function deliverTo(): Promise<{ label: string; place: string; zip?: string; fromAddress?: boolean }> {
  const [region, jar, h] = await Promise.all([getRegion(), cookies(), headers()])
  const a = region.address
  if (a) return { label: `Deliver to ${a.fullName.split(' ')[0]}`, place: `${a.city} ${a.zip}`, fromAddress: true }
  const zip = /^\d{5}$/.exec(jar.get('zip')?.value ?? '')?.[0]
  if (region.country !== 'US') return { label: 'Deliver to', place: region.countryName, zip }
  if (zip) return { label: 'Delivering to', place: zip, zip }
  // ponytail: other countries' visitors get US delivery (US and PK only), so only a US IP names a city
  const city = h.get('x-vercel-ip-country')?.toUpperCase() === 'US' && h.get('x-vercel-ip-city')
  return city
    ? { label: 'Delivering to', place: `${decodeURIComponent(city)} ${h.get('x-vercel-ip-postal-code') ?? ''}`.trim() }
    : { label: 'Deliver to', place: region.countryName }
}

// docs/design.md: one white row with a hairline under it, then a quiet row of links. No coloured chrome.
const barItem = 'nav-item flex items-center gap-1.5 px-2.5 py-2 text-sm'

export async function Header() {
  const user = await getUser()
  const [count, location, saver] = await Promise.all([cartCount(), deliverTo(), dataSaver()])
  const firstName = user ? user.name.split(' ')[0] : null
  const account = user ? { hasAddress: Boolean(location.fromAddress) } : null
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
    // a stacking context, so the flyouts' dimmer sits under the header and over the page
    <header className="relative z-50 border-b border-line bg-surface text-ink">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-2 gap-y-3 px-4 py-3 md:flex-nowrap md:py-4">
        <NavDrawer departments={departments} userName={firstName} account={account} variant="icon" />

        <Link href="/" aria-label="nile home" className="nav-item shrink-0 px-1 py-1">
          <span className="font-display text-[28px] leading-none tracking-[-0.02em]">
            nile<span className="text-accent">.</span>
          </span>
        </Link>

        <div className="hidden lg:block">
          <NavDrawer departments={departments} userName={firstName} account={account} variant="all" />
        </div>

        <Suspense fallback={<div className="order-last h-10 w-full rounded-md border border-line bg-surface md:order-none md:mx-4 md:flex-1" />}>
          <SearchBar departments={departments.map(({ slug, name }) => ({ slug, name }))} />
        </Suspense>

        <div className="ml-auto flex items-center gap-0.5 md:ml-0">
          {deliver(
            `${barItem} hidden max-w-[210px] lg:flex`,
            <>
              <PinIcon className="size-4 shrink-0 text-muted" />
              <span className="min-w-0">
                <span className="block text-[11px] leading-3 text-muted">{location.label}</span>
                <span className="block truncate text-sm leading-5 font-medium" title={location.place}>{location.place}</span>
              </span>
            </>,
          )}

          <LocaleMenu account={account} />

          <Link href={user ? '/account' : '/ap/signin'} className={`${barItem} md:hidden`}>
            {firstName ? `${firstName} ›` : 'Sign in ›'}
          </Link>

          <Flyout
            href={user ? '/account' : '/ap/signin'}
            className="hidden md:block"
            toggleLabel="Account & Lists menu"
            label={
              <span className="block max-w-[150px] truncate text-left">
                <span className="block text-[11px] leading-3 text-muted">Hello, {firstName ?? 'sign in'}</span>
                <span className="block text-sm leading-5 font-medium">Account &amp; Lists</span>
              </span>
            }
            panelClassName="right-0 w-[420px] pt-2"
          >
            <div className="card relative p-5 text-ink shadow-[0_12px_30px_rgba(25,23,19,0.12)]">
              {!user && (
                <div className="mb-4 border-b border-line pb-4 text-center">
                  <Link href="/ap/signin" className="btn btn-cart w-full">Sign in</Link>
                  <p className="mt-2 text-sm text-muted">
                    New here? <Link href="/ap/register" className="link">Create an account</Link>
                  </p>
                </div>
              )}
              <div className="flex gap-6 text-sm leading-7">
                <div className="w-1/2">
                  <h2 className="mb-1 text-base">Your lists</h2>
                  <ul className="text-muted">
                    <li><Link href="/lists?create=1" className={menuLink}>Create a List</Link></li>
                    <li><Link href="/lists" className={menuLink}>Shopping List</Link></li>
                  </ul>
                </div>
                <div className="w-1/2 border-l border-line pl-6">
                  <h2 className="mb-1 text-base">Your account</h2>
                  <ul className="text-muted">
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

          <Link href="/orders" className={`${barItem} hidden xl:flex`}>
            <span>
              <span className="block text-[11px] leading-3 text-muted">Returns</span>
              <span className="block text-sm leading-5 font-medium">&amp; Orders</span>
            </span>
          </Link>

          <Link href="/cart" className={`${barItem} relative`} aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`}>
            <span className="relative">
              <BagIcon className="size-6" />
              {count > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[18px] rounded-full bg-accent px-1 text-center text-[11px] leading-[18px] font-semibold text-white">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </span>
            <span className="hidden text-sm font-medium md:inline">Bag</span>
          </Link>
        </div>
      </div>

      <nav aria-label="Shortcuts" className="border-t border-line bg-paper">
        <div className="mx-auto flex max-w-[1120px] items-center gap-1 overflow-x-auto px-3 py-1.5 text-sm whitespace-nowrap">
          {shortcuts.map(([label, href]) => (
            <Link key={href} href={href} className="nav-item px-2.5 py-1.5 text-muted hover:text-ink">{label}</Link>
          ))}
          {/* a plain form, so the switch works before (and without) any JavaScript — the point of the feature.
              role="switch" carries the state in aria-checked, so the on/off word stays out of the accessible name */}
          <form action={setDataSaver} className="ml-auto shrink-0">
            <input type="hidden" name="on" value={saver ? '0' : '1'} />
            <button type="submit" role="switch" aria-checked={saver} aria-label="Data saver" className="nav-item flex cursor-pointer items-center gap-1.5 px-2.5 py-1.5 text-muted hover:text-ink">
              <span aria-hidden>Data saver</span>
              <span aria-hidden className={`rounded-full px-1.5 text-[11px] font-semibold ${saver ? 'bg-accent text-white' : 'bg-line text-muted'}`}>{saver ? 'ON' : 'OFF'}</span>
            </button>
          </form>
        </div>
      </nav>
      <DataSaverPrompt on={saver} />

      {deliver(
        'flex w-full items-center gap-1.5 border-t border-line bg-paper px-4 py-2 text-[13px] text-muted lg:hidden',
        <>
          <PinIcon className="size-4" /> {location.label} <span className="font-medium text-ink">{location.place}</span>
        </>,
      )}
    </header>
  )
}
