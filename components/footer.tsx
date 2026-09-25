import Link from 'next/link'
import { CURRENCIES } from '@/lib/region'
import { getRegion } from '@/lib/region-server'
import { FlagPK, FlagUS, Logo } from './icons'

const REPO = 'https://github.com/Shifu34/amazon-rebuild'
const focus = 'rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

const COLUMNS: { title: string; links: [string, string][] }[] = [
  {
    title: 'Get to Know Us',
    links: [['About nile', `${REPO}#readme`], ['nile on GitHub', REPO], ['QA Report', `${REPO}/blob/main/docs/qa-report.md`], ['Capture Test', `${REPO}/blob/main/CAPTURE-TEST.md`]],
  },
  {
    title: 'Shop with nile',
    links: [["Today's Deals", '/deals'], ['Best Sellers', '/bestsellers'], ['New Releases', '/s?sort=newest'], ['All Departments', '/s']],
  },
  {
    title: 'Your Account',
    links: [['Your Lists', '/lists'], ['Browsing History', '/history'], ['Your Payments', '/account/payments'], ['Login & Security', '/account/security']],
  },
  {
    title: 'Let Us Help You',
    links: [['Your Account', '/account'], ['Your Orders', '/orders'], ['Returns & Replacements', '/orders'], ['Your Addresses', '/account/addresses'], ['Customer Service', '/help']],
  },
]

const SERVICES: [string, string, string][] = [
  ["Today's Deals", 'Limited-time savings', '/deals'],
  ['Best Sellers', 'Most popular in every department', '/bestsellers'],
  ['New Releases', 'The newest arrivals', '/s?sort=newest'],
  ['All Departments', 'Browse the full catalog', '/s'],
  ['Your Lists', 'Save items for later', '/lists'],
  ['Order Tracking', 'Follow every package', '/orders'],
  ['Easy Returns', 'Start a return in a few clicks', '/orders'],
  ['Your Account', 'Orders, lists & settings', '/account'],
  ['Shopping Cart', 'Review items & check out', '/cart'],
  ['Browsing History', 'Pick up where you left off', '/history'],
  ['Invoices', 'Printable order invoices', '/orders'],
  ['Your Addresses', 'Ship to home, work & more', '/account/addresses'],
  ['Your Payments', 'Demo cards, nothing is charged', '/account/payments'],
  ['Login & Security', 'Name, email & password', '/account/security'],
  ['Customer Service', 'Help with orders & returns', '/help'],
  ['Demo Account', 'Sign in and try it out', '/ap/signin'],
  ['Create an Account', 'New to nile? Start here', '/ap/register'],
  ['Source Code', 'Built in the open on GitHub', REPO],
  ['About nile', 'How the rebuild works', `${REPO}#readme`],
  ['QA Report', 'How nile was tested', `${REPO}/blob/main/docs/qa-report.md`],
  ['Capture Test', 'Notes from the build', `${REPO}/blob/main/CAPTURE-TEST.md`],
]

function A({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  const cls = `${focus} ${className}`
  return href.startsWith('/') ? <Link href={href} className={cls}>{children}</Link> : <a href={href} className={cls}>{children}</a>
}

export async function Footer() {
  const { currency, country, countryName } = await getRegion()
  const c = CURRENCIES[currency]
  return (
    <footer className="mt-10 text-white">
      <a href="#top" className="block bg-nav-lighter py-[15px] text-center text-[13px] leading-5 hover:bg-[#485769] focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white">
        Back to top
      </a>

      <div className="bg-nav-light">
        {/* column starts and widths from Amazon's 1023px row at 1536px wide; long links wrap in the narrow last column, as there */}
        <nav aria-label="Footer" className="mx-auto grid max-w-[1063px] grid-cols-2 gap-x-6 px-4 pt-10 pb-8 md:grid-cols-[249fr_296fr_342fr_136fr] md:gap-x-0 md:px-5 md:pb-10">
          {COLUMNS.map((col) => (
            <div key={col.title} className="mb-4 md:mb-0 md:pr-4 md:last:pr-0">
              <h2 className="mt-1.5 mb-3.5 text-base leading-[1.2]">{col.title}</h2>
              <ul className="text-sm leading-[1.2] text-[#ddd]">
                {col.links.map(([label, href]) => (
                  <li key={label} className="mb-2.5">
                    <A href={href} className="hover:underline">{label}</A>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="flex flex-wrap items-center justify-center gap-x-[88px] gap-y-5 border-t border-[#3a4553] px-4 pt-[30px] pb-[47px]">
          <Link href="/" aria-label="nile home" className={`${focus} pt-1`}>
            <Logo />
          </Link>
          <ul aria-label="Region settings" className="flex flex-wrap justify-center gap-2 text-sm text-[#ccc]">
            <li className="flex h-[35px] w-[138px] items-center gap-[9px] rounded-[3px] border border-[#848688] pl-[17px]">
              <svg viewBox="0 0 20 20" className="size-[15px]" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
                <circle cx="10" cy="10" r="8" />
                <path d="M2 10h16M10 2c2.4 2.2 3.4 5 3.4 8s-1 5.8-3.4 8c-2.4-2.2-3.4-5-3.4-8s1-5.8 3.4-8z" />
              </svg>
              <span><span className="sr-only">Language: </span>English</span>
            </li>
            <li className="flex h-[35px] items-center gap-[9px] rounded-[3px] border border-[#848688] pr-7 pl-2">
              <span className="sr-only">Currency: </span>
              {c.prefix !== c.code && <span aria-hidden className="font-bold">{c.prefix}</span>}
              <span>{c.code} - {c.label}</span>
            </li>
            <li className="flex h-[35px] items-center gap-2 rounded-[3px] border border-[#848688] pr-7 pl-2">
              {country === 'PK' ? <FlagPK className="h-[13px] w-[19px]" /> : <FlagUS className="h-[13px] w-[19px]" />}
              <span><span className="sr-only">Country: </span>{countryName}</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="bg-[#131a22] px-4 pt-[30px] pb-6 text-xs leading-[1.15]">
        <ul className="mx-auto grid max-w-[1018px] grid-cols-2 gap-x-6 sm:grid-cols-4 lg:grid-cols-7 lg:gap-x-[46px]">
          {SERVICES.map(([name, desc, href]) => (
            <li key={name} className="pb-4">
              <A href={href} className="group block">
                <span className="block text-[#ddd] group-hover:underline">{name}</span>
                <span className="block text-[#999] group-hover:underline">{desc}</span>
              </A>
            </li>
          ))}
        </ul>
        {/* says plainly what the header switch changes, so nobody has to guess what they are turning on */}
        <p className="mt-4 text-center text-[#999]">
          Data saver (top of the page) loads smaller pictures, stops the home tiles playing and skips prefetching. Handy on metered mobile data.
        </p>
        <p className="mt-2 text-center text-[#ddd]">© 2026 nile, a working rebuild of Amazon.com. Not affiliated with Amazon.</p>
      </div>
    </footer>
  )
}
