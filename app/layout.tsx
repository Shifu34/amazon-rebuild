import type { Metadata } from 'next'
import { Fraunces, Inter } from 'next/font/google'
import { preconnect } from 'react-dom'
import './globals.css'

// docs/design.md: a serif carries the headings, a plain sans carries everything else
const display = Fraunces({ subsets: ['latin'], weight: ['600'], style: ['normal'], variable: '--font-fraunces', display: 'swap' })
const text = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'nile: shop everything, delivered', template: '%s | nile' },
  description: 'A working shop: search, product pages, cart, checkout, orders, returns and lists, priced honestly to your door.',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // every product image comes from DummyJSON's CDN: open that connection while the HTML is still streaming
  preconnect('https://cdn.dummyjson.com')
  return (
    <html lang="en" className={`${display.variable} ${text.variable}`}>
      <body id="top" className="flex min-h-screen flex-col antialiased">
        {children}
      </body>
    </html>
  )
}
