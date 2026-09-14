import Link from 'next/link'
import { Logo } from './icons'

const COLUMNS: { title: string; links: [string, string][] }[] = [
  { title: 'Shop', links: [["Today's Deals", '/deals'], ['Best Sellers', '/bestsellers'], ['New Releases', '/s?sort=newest'], ['All departments', '/s']] },
  { title: 'Your Account', links: [['Your Account', '/account'], ['Your Orders', '/orders'], ['Your Lists', '/lists'], ['Browsing History', '/history']] },
  { title: 'Let Us Help You', links: [['Your Addresses', '/account/addresses'], ['Returns & Replacements', '/orders'], ['Shopping Cart', '/cart']] },
]

export function Footer() {
  return (
    <footer className="mt-10 text-white">
      <a href="#top" className="block bg-nav-lighter py-4 text-center text-[13px] hover:bg-[#485769]">
        Back to top
      </a>
      <div className="bg-nav-light px-6 py-10">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-8 sm:grid-cols-3">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="mb-2 text-base">{col.title}</h2>
              <ul className="space-y-1.5 text-sm text-[#ddd]">
                {col.links.map(([label, href]) => (
                  <li key={href + label}>
                    <Link href={href} className="hover:underline">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col items-center gap-3 bg-nav px-6 py-8 text-center text-xs text-[#ddd]">
        <Logo />
        <p className="max-w-xl">
          nile is a working rebuild of Amazon.com, built for the 8x assignment. It is not affiliated with Amazon.
          Orders, payments and deliveries are simulated; nothing is charged or shipped.
        </p>
      </div>
    </footer>
  )
}
