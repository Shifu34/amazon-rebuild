import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'nile: shop everything, delivered', template: '%s | nile' },
  description: 'A working rebuild of Amazon.com: search, product pages, cart, checkout, orders, returns and lists.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body id="top" className="flex min-h-screen flex-col antialiased">
        {children}
      </body>
    </html>
  )
}
