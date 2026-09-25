import { cookies } from 'next/headers'
import { CompareProvider, CompareTray } from '@/components/compare/compare'
import { COMPARE_COOKIE, parseCompare } from '@/components/compare/ids'
import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { RegionProvider } from '@/components/region-provider'
import { getProduct } from '@/lib/catalog'
import { getRegion } from '@/lib/region-server'

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const { currency, rate, country } = await getRegion()
  // the tray's thumbnails come from the cookie's ids, so a reload shows the selection without a flash
  const compare = parseCompare((await cookies()).get(COMPARE_COOKIE)?.value)
    .map(getProduct)
    .filter((p) => !!p)
    .map(({ id, title, thumbnail }) => ({ id, title, thumbnail }))
  return (
    <RegionProvider currency={currency} rate={rate} country={country}>
      <CompareProvider initial={compare}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:rounded-md focus:bg-white focus:px-4 focus:py-2.5 focus:text-sm focus:font-bold focus:text-ink focus:shadow-lg focus:ring-2 focus:ring-focus focus:outline-none"
        >
          Skip to main content
        </a>
        <Header />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">{children}</main>
        <Footer />
        <CompareTray />
      </CompareProvider>
    </RegionProvider>
  )
}
