import Link from 'next/link'
import { CURRENCIES } from '@/lib/region'
import { getRegion } from '@/lib/region-server'
import { FlagPK, FlagUS } from './icons'

const REPO = 'https://github.com/Shifu34/amazon-rebuild'
const focus = 'rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

// docs/design.md: four short columns, not a sitemap. Amazon's 21-tile service grid was noise, so it is gone.
const COLUMNS: { title: string; links: [string, string][] }[] = [
  {
    title: 'Shop',
    links: [["Today's Deals", '/deals'], ['Best Sellers', '/bestsellers'], ['New Releases', '/s?sort=newest'], ['All Departments', '/s']],
  },
  {
    title: 'Your account',
    links: [['Your Orders', '/orders'], ['Your Lists', '/lists'], ['Your Addresses', '/account/addresses'], ['Login & Security', '/account/security']],
  },
  {
    title: 'Help',
    links: [['Customer Service', '/help'], ['Returns & Replacements', '/orders'], ['Browsing History', '/history'], ['Your Payments', '/account/payments']],
  },
  {
    title: 'About',
    links: [['About nile', `${REPO}#readme`], ['nile on GitHub', REPO], ['QA Report', `${REPO}/blob/main/docs/qa-report.md`], ['Capture Test', `${REPO}/blob/main/CAPTURE-TEST.md`]],
  },
]

function A({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  const cls = `${focus} ${className}`
  return href.startsWith('/') ? <Link href={href} className={cls}>{children}</Link> : <a href={href} className={cls}>{children}</a>
}

export async function Footer() {
  const { currency, country, countryName } = await getRegion()
  const c = CURRENCIES[currency]
  const chip = 'flex h-9 items-center gap-2 rounded-full border border-white/25 px-4'
  return (
    <footer className="mt-16 bg-nav text-white">
      <a href="#top" className="block border-b border-white/10 py-4 text-center text-sm text-white/70 hover:text-white focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white">
        Back to top
      </a>

      <div className="mx-auto max-w-[1120px] px-4 py-12">
        <nav aria-label="Footer" className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="mb-3 text-base text-white">{col.title}</h2>
              <ul className="space-y-2 text-sm text-white/70">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <A href={href} className="hover:text-white hover:underline">{label}</A>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-6 border-t border-white/10 pt-8">
          <Link href="/" aria-label="nile home" className={focus}>
            <span className="font-display text-2xl leading-none">nile<span className="text-white/50">.</span></span>
          </Link>
          <ul aria-label="Region settings" className="flex flex-wrap gap-2 text-sm text-white/70">
            <li className={chip}>
              <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
                <circle cx="10" cy="10" r="8" />
                <path d="M2 10h16M10 2c2.4 2.2 3.4 5 3.4 8s-1 5.8-3.4 8c-2.4-2.2-3.4-5-3.4-8s1-5.8 3.4-8z" />
              </svg>
              <span><span className="sr-only">Language: </span>English</span>
            </li>
            <li className={chip}>
              <span className="sr-only">Currency: </span>
              {c.prefix !== c.code && <span aria-hidden className="font-semibold">{c.prefix}</span>}
              <span>{c.code} - {c.label}</span>
            </li>
            <li className={chip}>
              {country === 'PK' ? <FlagPK className="h-3 w-4" /> : <FlagUS className="h-3 w-4" />}
              <span><span className="sr-only">Country: </span>{countryName}</span>
            </li>
          </ul>
        </div>

        <div className="mt-8 space-y-2 text-sm text-white/50">
          {/* says plainly what the header switch changes, so nobody has to guess what they are turning on */}
          <p>Data saver (top of the page) loads smaller pictures, stops the home tiles playing and skips prefetching. Handy on metered mobile data.</p>
          <p>© 2026 nile. A demo store: nothing is charged and nothing ships. Not affiliated with Amazon.</p>
        </div>
      </div>
    </footer>
  )
}
