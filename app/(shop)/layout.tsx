import { Footer } from '@/components/footer'
import { Header } from '@/components/header'

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:rounded-md focus:bg-white focus:px-4 focus:py-2.5 focus:text-sm focus:font-bold focus:text-ink focus:shadow-lg focus:ring-2 focus:ring-focus focus:outline-none"
      >
        Skip to main content
      </a>
      <Header />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">{children}</main>
      <Footer />
    </>
  )
}
