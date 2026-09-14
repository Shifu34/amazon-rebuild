import type { Metadata } from 'next'
import { Inter_Tight } from 'next/font/google'
import { preconnect } from 'react-dom'
import './globals.css'

// heavy display face for home headlines, the closest open font to Amazon Ember Display Heavy (Tailwind `font-display`)
const display = Inter_Tight({ subsets: ['latin'], weight: '900', variable: '--font-inter-tight', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'nile: shop everything, delivered', template: '%s | nile' },
  description: 'A working rebuild of Amazon.com: search, product pages, cart, checkout, orders, returns and lists.',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // every product image comes from DummyJSON's CDN: open that connection while the HTML is still streaming
  preconnect('https://cdn.dummyjson.com')
  return (
    <html lang="en" className={display.variable}>
      <body id="top" className="flex min-h-screen flex-col antialiased">
        {children}
      </body>
    </html>
  )
}
