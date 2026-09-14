import Link from 'next/link'
import { headers } from 'next/headers'
import { Suspense } from 'react'
import { signOut } from '@/app/actions/auth'
import { getUser } from '@/lib/auth'
import { cartCount } from '@/lib/cart'
import { CATEGORY_NAMES, DEPARTMENTS } from '@/lib/catalog'
import { one } from '@/lib/db'
import { CaretIcon, CartIcon, Logo, PinIcon } from './icons'
import { NavDrawer } from './nav-drawer'
import { SearchBar } from './search-bar'

const departments = DEPARTMENTS.map((d) => ({ ...d, categories: d.categories.map((slug) => ({ slug, name: CATEGORY_NAMES[slug] })) }))

const SHORTCUTS: [string, string][] = [
  ["Today's Deals", '/deals'],
  ['Best Sellers', '/bestsellers'],
  ['New Releases', '/s?sort=newest'],
  ...DEPARTMENTS.map((d): [string, string] => [d.name, `/s?i=${d.slug}`]),
]

async function deliverTo(userId: string | undefined) {
  if (userId) {
    const a = await one<{ full_name: string; city: string; zip: string }>(
      'select full_name, city, zip from addresses where user_id = $1 order by is_default desc, created_at desc limit 1',
      [userId],
    )
    if (a) return { label: `Deliver to ${a.full_name.split(' ')[0]}`, place: `${a.city} ${a.zip}` }
  }
  const h = await headers()
  const city = h.get('x-vercel-ip-city')
  return city
    ? { label: 'Delivering to', place: `${decodeURIComponent(city)} ${h.get('x-vercel-ip-postal-code') ?? ''}`.trim() }
    : { label: 'Deliver to', place: 'United States' }
}

export async function Header() {
  const user = await getUser()
  const [count, location] = await Promise.all([cartCount(), deliverTo(user?.id)])
  const firstName = user ? user.name.split(' ')[0] : null
  const locationHref = user ? '/account/addresses' : '/ap/signin?return_to=/account/addresses'

  return (
    <header className="text-white">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-2 bg-nav px-2 py-2 md:h-[60px] md:flex-nowrap md:py-0">
        <NavDrawer departments={departments} userName={firstName} variant="icon" />
        <Link href="/" aria-label="nile home" className="nav-item px-2 pt-2 pb-1">
          <Logo />
        </Link>
        <Link href={locationHref} className="nav-item hidden items-end gap-0.5 px-2 py-2 lg:flex">
          <PinIcon className="mb-0.5 size-4 shrink-0" />
          <span className="leading-4">
            <span className="block text-xs text-[#ccc]">{location.label}</span>
            <span className="block text-sm font-bold whitespace-nowrap">{location.place}</span>
          </span>
        </Link>

        <Suspense fallback={<div className="order-last h-10 w-full rounded-md bg-white md:order-none md:mx-2 md:flex-1" />}>
          <SearchBar departments={departments.map(({ slug, name }) => ({ slug, name }))} />
        </Suspense>

        <div className="ml-auto flex items-center md:ml-0">
          <Link href={user ? '/account' : '/ap/signin'} className="nav-item px-2 py-2 text-sm md:hidden">
            {firstName ? `${firstName} ›` : 'Sign in ›'}
          </Link>

          <div className="group relative hidden md:block">
            <Link href={user ? '/account' : '/ap/signin'} className="nav-item block px-2 py-2 leading-4" aria-haspopup="true">
              <span className="block text-xs whitespace-nowrap">Hello, {firstName ?? 'sign in'}</span>
              <span className="flex items-center gap-1 text-sm font-bold whitespace-nowrap">
                Account &amp; Lists <CaretIcon className="mt-0.5 h-1.5 w-2 text-[#a7acb2]" />
              </span>
            </Link>
            <div className="invisible absolute top-full right-0 z-50 w-[440px] pt-2 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              <div className="rounded-sm bg-white p-4 text-ink shadow-[0_2px_12px_rgba(0,0,0,0.35)]">
                {!user && (
                  <div className="mb-3 border-b border-line pb-3 text-center">
                    <Link href="/ap/signin" className="btn btn-cart w-56">Sign in</Link>
                    <p className="mt-1.5 text-xs">
                      New customer?{' '}
                      <Link href="/ap/signin" className="link">Start here.</Link>
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 text-[13px]">
                  <div className="pr-4">
                    <h3 className="mb-1.5 text-base">Your Lists</h3>
                    <ul className="space-y-1.5">
                      <li><Link href="/lists" className="hover:text-link-hover hover:underline">Shopping List</Link></li>
                      <li><Link href="/lists?create=1" className="hover:text-link-hover hover:underline">Create a List</Link></li>
                    </ul>
                  </div>
                  <div className="border-l border-line pl-4">
                    <h3 className="mb-1.5 text-base">Your Account</h3>
                    <ul className="space-y-1.5">
                      <li><Link href="/account" className="hover:text-link-hover hover:underline">Account</Link></li>
                      <li><Link href="/orders" className="hover:text-link-hover hover:underline">Orders</Link></li>
                      <li><Link href="/history" className="hover:text-link-hover hover:underline">Browsing History</Link></li>
                      <li><Link href="/account/addresses" className="hover:text-link-hover hover:underline">Addresses</Link></li>
                      {user && (
                        <li>
                          <form action={signOut}>
                            <button type="submit" className="cursor-pointer hover:text-link-hover hover:underline">Sign Out</button>
                          </form>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Link href="/orders" className="nav-item hidden px-2 py-2 leading-4 md:block">
            <span className="block text-xs">Returns</span>
            <span className="block text-sm font-bold whitespace-nowrap">&amp; Orders</span>
          </Link>

          <Link href="/cart" className="nav-item flex items-end px-2 py-1.5" aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`}>
            <span className="relative">
              <CartIcon className="h-8 w-10" />
              <span className="absolute -top-1 left-[17px] w-5 text-center text-base leading-5 font-bold text-brand">{count > 99 ? '99+' : count}</span>
            </span>
            <span className="hidden text-sm font-bold md:inline">Cart</span>
          </Link>
        </div>
      </div>

      <nav aria-label="Shortcuts" className="flex h-[39px] items-center gap-0.5 overflow-x-auto bg-nav-light px-2 text-sm whitespace-nowrap">
        <NavDrawer departments={departments} userName={firstName} variant="all" />
        {SHORTCUTS.map(([label, href]) => (
          <Link key={href} href={href} className="nav-item px-2 py-1.5">{label}</Link>
        ))}
      </nav>

      <Link href={locationHref} className="flex items-center gap-1.5 bg-nav-lighter px-3 py-2 text-[13px] md:hidden">
        <PinIcon className="size-4" /> {location.label} {location.place}
      </Link>
    </header>
  )
}
