import Link from 'next/link'
import { Price } from '@/components/price'
import type { Product } from '@/lib/catalog'
import { DealBadge } from './deal'

export type Tile = { label: string; href: string; image: string }

// White home card: 21px headline, content, teal link pinned to the bottom. Fixed 420px height from lg up, like Amazon's grid.
// Phones get a compact version (smaller type and padding) so category cards don't push deals several screens down.
export function Card({ title, link, className = '', children }: { title: string; link?: { label: string; href: string }; className?: string; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col bg-white p-3 sm:p-5 lg:h-[420px] ${className}`}>
      <h2 className="mb-2 text-base leading-5 font-bold sm:mb-3 sm:text-[21px] sm:leading-[27px]">{title}</h2>
      <div className="min-h-0 flex-1">{children}</div>
      {link && <Link href={link.href} className="link mt-2 self-start text-xs sm:mt-3 sm:text-[13px]">{link.label}</Link>}
    </div>
  )
}

// The home grids are two columns on phones: quads span both and show their four tiles in one row.
export function QuadCard({ title, tiles, link, className = '' }: { title: string; tiles: Tile[]; link: { label: string; href: string }; className?: string }) {
  return (
    <Card title={title} link={link} className={`max-sm:col-span-2 ${className}`}>
      {/* from lg the card height is fixed, so tiles share whatever a one- or two-line title leaves */}
      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-3 lg:h-full lg:grid-rows-2">
        {tiles.map((t) => (
          <li key={t.href + t.label} className="min-w-0 lg:min-h-0">
            <Link href={t.href} className="group flex h-full flex-col">
              <span className="flex aspect-square items-center justify-center bg-[#f7f7f7] p-1.5 sm:p-2 lg:aspect-auto lg:min-h-0 lg:flex-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.image} alt="" className="max-h-full max-w-full object-contain mix-blend-multiply" />
              </span>
              <span className="mt-1 block truncate text-[11px] group-hover:text-link-hover group-hover:underline sm:text-xs">{t.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function ImageCard({ title, image, href, link, className }: { title: string; image: string; href: string; link: string; className?: string }) {
  return (
    <Card title={title} link={{ label: link, href }} className={className}>
      <Link href={href} tabIndex={-1} aria-hidden className="flex h-32 items-center justify-center bg-[#f7f7f7] p-3 sm:h-64 sm:p-4 lg:h-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" loading="lazy" className="max-h-full max-w-full object-contain mix-blend-multiply" />
      </Link>
    </Card>
  )
}

function DealPromo({ product: p, className = '' }: { product: Product; className?: string }) {
  return (
    <Link href={`/dp/${p.id}`} className={`group block ${className}`}>
      <span className="flex h-[130px] items-center justify-center bg-[#f7f7f7] p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.thumbnail} alt="" className="max-h-full max-w-full object-contain mix-blend-multiply" />
      </span>
      <span className="mt-2 block"><DealBadge discount={p.discount} /></span>
      <span className="mt-1 flex items-baseline gap-2">
        <span className="text-lg leading-6"><Price value={p.price} /></span>
        <span className="truncate text-sm group-hover:text-link-hover group-hover:underline">{p.title}</span>
      </span>
    </Link>
  )
}

export function SignInCard({ deal, className = '' }: { deal?: Product; className?: string }) {
  return (
    <Card title="Sign in for the best experience" className={`max-sm:col-span-2 ${className}`}>
      <Link href="/ap/signin" className="btn btn-cart btn-lg w-full">Sign in securely</Link>
      <p className="mt-2 text-center text-xs">
        New customer? <Link href="/ap/register" className="link">Start here.</Link>
      </p>
      {deal && <DealPromo product={deal} className="mt-5 max-sm:hidden" />}
    </Card>
  )
}

const SHORTCUTS = [
  ['Your Orders', '/orders'],
  ['Your Lists', '/lists'],
  ['Your Account', '/account'],
  ['Browsing History', '/history'],
]

// Signed-in replacement for the sign-in card: greeting, a deal picked from what they browse, account shortcuts.
export function GreetingCard({ name, deal, className = '' }: { name: string; deal?: Product; className?: string }) {
  return (
    <Card title={`Hi, ${name}`} className={`max-sm:col-span-2 ${className}`}>
      {deal && (
        <>
          <p className="mb-2 text-sm text-muted">Recommended deal for you</p>
          <DealPromo product={deal} />
        </>
      )}
      <ul className="mt-4 grid grid-cols-2 gap-2">
        {SHORTCUTS.map(([label, href]) => (
          <li key={href}><Link href={href} className="btn btn-plain w-full">{label}</Link></li>
        ))}
      </ul>
    </Card>
  )
}
