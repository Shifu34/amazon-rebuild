import Link from 'next/link'
import { QuadCard, type Card, type Tile } from '@/components/home/cards'
import { DealRail } from '@/components/home/deal'
import { inScope, ranked } from '@/components/home/scope'
import { PictureTiles, type PictureTile } from '@/components/home/tiles'
import { ProductCarousel } from '@/components/product-carousel'
import { displayAmount, parseQuery, toHref, toSearch, toUrlDollars, type Query } from '@/components/search/params'
import { getUser } from '@/lib/auth'
import { deals, getProduct, related, search, type Product } from '@/lib/catalog'
import { query } from '@/lib/db'
import type { CurrencyCode } from '@/lib/region'
import { getRegion } from '@/lib/region-server'

// The catalog is static, so every card and tile below is computed once per server start.
const BLANK = parseQuery({})
const find = (patch: Partial<Query>) => toHref({ ...BLANK, ...patch })
// a search tile links to /s with these filters and is pictured with a product that search shows
const s = (label: string, patch: Partial<Query>) => ({ label, href: find(patch), items: search(toSearch({ ...BLANK, ...patch })).items })
const at = (label: string, href: string, items: Product[]) => ({ label, href, items })

// Each tile pictures the first product of its destination not already pictured in the card. A card with an empty destination is left out.
function card(title: string, href: string, sources: ReturnType<typeof at>[]): Card[] {
  const used = new Set<number>()
  const tiles: Tile[] = []
  for (const { label, href, items } of sources) {
    const p = items.find((x) => !used.has(x.id))
    if (!p) return []
    used.add(p.id)
    tiles.push({ label, href, image: p.thumbnail })
  }
  return [{ title, href, tiles }]
}

const ALL_DEALS = deals(Infinity)
const dealsIn = (slug: string) => ALL_DEALS.filter((p) => inScope(p, slug))

// the first picture is the big one, so it uses the full-size photo
const tile = (title: string, href: string, bg: string, products: (Product | undefined)[], subtitle?: string): PictureTile[] => {
  const [main, ...rest] = products.filter((p) => p !== undefined)
  return main ? [{ title, subtitle, href, bg, images: [main.images[0] ?? main.thumbnail, ...rest.map((p) => p.thumbnail)] }] : []
}
const ids = (...list: number[]) => list.map(getProduct)

const TILES: PictureTile[] = [
  tile('Shop kitchen must-haves', find({ i: 'kitchen-accessories' }), '#d2dad9', ids(66, 51, 68)),
  tile('Upgrade your everyday tech', find({ i: 'electronics' }), '#aaf3fc', ids(82, 161, 123), 'Phones, laptops & more'),
  tile('Shop all things beauty', find({ i: 'beauty-personal-care' }), '#f7cdbf', ids(2, 4, 8)),
  tile('Start looking sharp', find({ i: 'mens-fashion' }), '#d3cdc4', ids(85, 90, 93)),
  tile('Get in the game', find({ i: 'sports' }), '#c5d5f2', ids(140, 152, 139)),
  tile('Dress to impress', find({ i: 'womens-fashion' }), '#f3d3ec', ids(177, 172, 187)),
  tile('Fresh picks for your pantry', find({ i: 'grocery' }), '#e1eec3', ids(40, 30, 29)),
  tile("Today's Deals", '/deals', '#ffe3a3', ALL_DEALS.slice(0, 3), ALL_DEALS.length ? `Up to ${ALL_DEALS[0].discount}% off` : undefined),
].flat()

// "under $25" cards in rupees: a round amount at or above the dollar one, so every destination still has results
const RUPEES: Record<number, number> = { 10: 3000, 25: 7000, 50: 15000, 100: 30000, 150: 45000 }

const cardsIn = (c: CurrencyCode): Card[] => {
  const max = (usd: number) => (c === 'USD' ? usd : toUrlDollars(RUPEES[usd], c))
  const under = (usd: number) => displayAmount(max(usd), c)
  return [
    card('Plug in with our electronics', find({ i: 'electronics' }), [s('Cell phones', { i: 'smartphones' }), s('Laptops', { i: 'laptops' }), s('Tablets', { i: 'tablets' }), s('Smart speakers', { k: 'smart speakers' })]),
    card('Score the top Apple gear', find({ brand: ['Apple'] }), [s('iPhone', { k: 'iphone', brand: ['Apple'] }), s('MacBook', { k: 'macbook' }), s('iPad', { k: 'ipad' }), s('AirPods', { k: 'airpods' })]),
    card('Gear up for game day', find({ i: 'sports' }), [s('Basketball', { k: 'basketball', i: 'sports' }), s('Cricket', { k: 'cricket' }), s('Tennis', { k: 'tennis' }), s('Baseball', { k: 'baseball', i: 'sports' })]),
    card(`Popular finds under ${under(25)}`, find({ max: max(25) }), [s('Kitchen', { i: 'kitchen-accessories', max: max(25) }), s('Beauty', { i: 'beauty-personal-care', max: max(25) }), s("Women's fashion", { i: 'womens-fashion', max: max(25) }), s('Sports', { i: 'sports', max: max(25) })]),

    card('Fantastic finds for home', find({ i: 'home-kitchen' }), [s('Kitchen', { i: 'kitchen-accessories' }), s('Home décor', { i: 'home-decoration' }), s('Furniture', { i: 'furniture' }), s('Lighting', { k: 'lamp', i: 'home-kitchen' })]),
    card('Shine brighter with your fashion faves', find({ i: 'womens-fashion' }), [s('Jewelry', { i: 'womens-jewellery' }), s('Handbags', { i: 'womens-bags' }), s('Footwear', { i: 'womens-shoes' }), s('Dresses', { i: 'womens-dresses' })]),
    card('Unveil your radiance', find({ i: 'beauty-personal-care' }), [s('Make-up', { i: 'beauty' }), s('Fragrances', { i: 'fragrances' }), s('Skin care', { i: 'skin-care' }), s('Body care', { k: 'body' })]),
    card('Find your next phone', find({ i: 'smartphones' }), [s('iPhone', { k: 'iphone', i: 'smartphones' }), s('Samsung Galaxy', { k: 'samsung galaxy', i: 'smartphones' }), s('Realme', { k: 'realme' }), s('Vivo', { k: 'vivo' })]),

    card('Fashion trends in shoes', find({ k: 'shoes' }), [s("Women's", { i: 'womens-shoes' }), s("Men's", { i: 'mens-shoes' }), s('Sneakers', { k: 'sneakers' }), s('Heels', { k: 'heel' })]),
    card('Cook like a pro', find({ i: 'kitchen-accessories' }), [s('Cookware', { k: 'cookware' }), s('Appliances', { k: 'kitchen appliances' }), s('Utensils', { k: 'utensils' }), s('Drinkware', { k: 'drinkware' })]),
    card(`Shoes under ${under(100)}`, find({ k: 'shoes', max: max(100) }), [s("Women's", { i: 'womens-shoes', max: max(100) }), s("Men's", { i: 'mens-shoes', max: max(100) }), s('Casual shoes', { k: 'casual shoes', max: max(100) }), s('Heels', { k: 'heel', max: max(100) })]),
    card('Deals on top categories', '/deals', [at('Electronics', '/deals?i=electronics', dealsIn('electronics')), at('Fashion', '/deals?i=womens-fashion', dealsIn('womens-fashion')), at('Beauty', '/deals?i=beauty-personal-care', dealsIn('beauty-personal-care')), at('Home', '/deals?i=home-kitchen', dealsIn('home-kitchen'))]),

    card(`New home arrivals under ${under(50)}`, find({ i: 'home-kitchen', max: max(50), sort: 'newest' }), [s('Kitchen & dining', { i: 'kitchen-accessories', max: max(50), sort: 'newest' }), s('Décor', { i: 'home-decoration', max: max(50), sort: 'newest' }), s('Cookware', { k: 'cookware', max: max(50), sort: 'newest' }), s('Appliances', { k: 'kitchen appliances', max: max(50), sort: 'newest' })]),
    card('Discover the latest arrivals', find({ sort: 'newest' }), [s('Electronics', { i: 'electronics', sort: 'newest' }), s('Home', { i: 'home-kitchen', sort: 'newest' }), s('Beauty', { i: 'beauty-personal-care', sort: 'newest' }), s('Fashion', { i: 'womens-fashion', sort: 'newest' })]),
    card('Dapper picks for men', find({ i: 'mens-fashion' }), [s('Shirts', { i: 'mens-shirts' }), s('Shoes', { i: 'mens-shoes' }), s('Watches', { i: 'mens-watches' }), s('Sunglasses', { i: 'sunglasses' })]),
    card('Level up your beauty routine', find({ i: 'beauty' }), [s('Mascara', { k: 'mascara' }), s('Lipstick', { k: 'lipstick' }), s('Eyeshadow', { k: 'eyeshadow' }), s('Nail polish', { k: 'nail polish' })]),

    card('Handpicked smart gadgets', find({ i: 'mobile-accessories' }), [s('Smart speakers', { k: 'smart speakers' }), s('Earphones', { k: 'earphones' }), s('Chargers', { k: 'charger' }), s('Smartwatches', { k: 'smartwatch' })]),
    card('Stock up on groceries', find({ i: 'grocery' }), [s('Fruits', { k: 'fruits' }), s('Vegetables', { k: 'vegetables' }), s('Beverages', { k: 'beverages' }), s('Dairy & eggs', { k: 'dairy' })]),
    card('Timeless watches', find({ k: 'watches' }), [s("Men's", { i: 'mens-watches' }), s("Women's", { i: 'womens-watches' }), s('Rolex', { k: 'rolex' }), s(`Under ${under(150)}`, { k: 'watches', max: max(150) })]),
    card("Fragrances they'll love", find({ i: 'fragrances' }), ['Chanel', 'Dior', 'Gucci', 'Calvin Klein'].map((b) => s(b, { i: 'fragrances', brand: [b] }))),

    card('Explore Best Sellers', '/bestsellers', [at('Electronics', '/bestsellers/electronics', ranked('electronics')), at('Home & Kitchen', '/bestsellers/home-kitchen', ranked('home-kitchen')), at('Beauty', '/bestsellers/beauty-personal-care', ranked('beauty-personal-care')), at('Fashion', '/bestsellers/womens-fashion', ranked('womens-fashion'))]),
    card('Highly rated by customers', find({ rating: 4 }), [s('Electronics', { i: 'electronics', rating: 4 }), s('Home', { i: 'home-kitchen', rating: 4 }), s('Beauty', { i: 'beauty-personal-care', rating: 4 }), s('Sports', { i: 'sports', rating: 4 })]),
    card(`Everyday essentials under ${under(10)}`, find({ max: max(10) }), [s('Kitchen tools', { i: 'kitchen-accessories', max: max(10) }), s('Grocery', { i: 'grocery', max: max(10) }), s('Beauty', { i: 'beauty-personal-care', max: max(10) }), s('Sports', { i: 'sports', max: max(10) })]),
    card(`Women's fashion under ${under(50)}`, find({ i: 'womens-fashion', max: max(50) }), [s('Tops', { i: 'tops', max: max(50) }), s('Shoes', { i: 'womens-shoes', max: max(50) }), s('Handbags', { i: 'womens-bags', max: max(50) }), s('Jewelry', { i: 'womens-jewellery', max: max(50) })]),

    card('Refresh your space', find({ i: 'home-decoration' }), [s('Plants', { k: 'plant' }), s('Photo frames', { k: 'photo frame' }), s('Lighting', { k: 'lamp', i: 'home-decoration' }), s('Swings', { k: 'swing' })]),
  ].flat()
}
const CARDS: Record<CurrencyCode, Card[]> = { USD: cardsIn('USD'), PKR: cardsIn('PKR') }

// soft picture backgrounds, one per card in turn
const TINTS = ['#eef3f8', '#fdf1e7', '#eef6ee', '#f6eff8', '#fff6d9', '#eaf5f7', '#f9eeee', '#f2f2f2']
const PAGE = 24 // divisible by 4, 3, 2 and 1 columns, so every grid row is full

// Views are written by the product page. A failed read only hides the personalized card, like Amazon's silent widgets.
async function recentlyViewed(userId: string): Promise<Product[]> {
  const rows = await query<{ product_id: number }>('select product_id from browsing_history where user_id = $1 order by viewed_at desc limit 20', [userId]).catch(() => [])
  return rows.flatMap((r) => getProduct(r.product_id) ?? [])
}

async function boughtBefore(userId: string): Promise<Product[]> {
  const rows = await query<{ product_id: number }>(
    `select oi.product_id from order_items oi join orders o on o.id = oi.order_id
     where o.user_id = $1 and o.cancelled_at is null group by oi.product_id order by max(o.placed_at) desc limit 4`,
    [userId],
  ).catch(() => [])
  return rows.flatMap((r) => getProduct(r.product_id) ?? [])
}

const productTiles = (list: Product[]) => list.slice(0, 4).map((p) => ({ label: p.title, href: `/dp/${p.id}`, image: p.thumbnail }))
const railBox = 'overflow-hidden rounded-lg border border-line'

function CardGrid({ cards, offset }: { cards: Card[]; offset: number }) {
  return (
    <div className="grid gap-x-2 gap-y-3 sm:grid-cols-2 sm:gap-y-[25px] lg:grid-cols-3 xl:grid-cols-4">
      {cards.map((c, i) => (
        <QuadCard key={c.title} {...c} tint={TINTS[(offset + i) % TINTS.length]} eager={offset + i < 4} />
      ))}
    </div>
  )
}

export default async function Home() {
  const [user, { currency }] = await Promise.all([getUser(), getRegion()])
  const [viewed, bought] = user ? await Promise.all([recentlyViewed(user.id), boughtBefore(user.id)]) : [[], []]
  const personal: Card[] = [
    ...(viewed.length ? [{ title: 'Pick up where you left off', href: '/history', tiles: productTiles(viewed) }] : []),
    ...(bought.length ? [{ title: 'Buy again', href: '/orders?tab=buy-again', tiles: productTiles(bought) }] : []),
  ]
  const cards = [...personal, ...CARDS[currency]].slice(0, PAGE)
  const seen = new Set(viewed.map((p) => p.id))
  const inspired = [...new Set(viewed.slice(0, 6).flatMap((p) => related(p, 8)))].filter((p) => !seen.has(p.id)).slice(0, 20)

  return (
    <div className="bg-white">
      <h1 className="sr-only">nile home</h1>
      {/* overflow-x-clip: sr-only prices inside the shared carousels are positioned outside their scroll box and would widen the page */}
      <div className="mx-auto max-w-[1536px] overflow-x-clip pt-2">
        <PictureTiles tiles={TILES} />
        <div className="space-y-3 px-4 pt-5 sm:space-y-[25px]">
          <CardGrid cards={cards.slice(0, PAGE / 2)} offset={0} />
          <div className={railBox}>
            <DealRail products={ALL_DEALS.slice(0, 20)} />
          </div>
          <CardGrid cards={cards.slice(PAGE / 2)} offset={PAGE / 2} />
          {inspired.length > 0 && (
            <div className={railBox}>
              <ProductCarousel title="Inspired by your browsing history" products={inspired} />
            </div>
          )}
          <div className={railBox}>
            <ProductCarousel title="Best Sellers in Home & Kitchen" products={ranked('home-kitchen', 20)} href="/bestsellers/home-kitchen" />
          </div>
        </div>
      </div>

      {/* -mb-10 cancels the footer's top margin so "Back to top" sits right under this band, as on Amazon */}
      <section aria-labelledby="home-bottom" className="mt-8 -mb-10 border-t border-line px-4 py-6 text-center">
        {user ? (
          <>
            <h2 id="home-bottom" className="text-base">Your browsing history</h2>
            {viewed.length > 0 ? (
              <Link href="/history" className="link mt-1 inline-block text-sm">View or edit your browsing history</Link>
            ) : (
              <p className="mx-auto mt-1 max-w-xl text-sm text-muted">After viewing product detail pages, look here to find an easy way to navigate back to pages you are interested in.</p>
            )}
          </>
        ) : (
          <>
            <h2 id="home-bottom" className="text-sm font-normal">See personalized recommendations</h2>
            <Link href="/ap/signin" className="btn btn-cart mt-2 w-56">Sign in</Link>
            <p className="mt-1.5 text-xs">
              New customer? <Link href="/ap/register" className="link">Start here.</Link>
            </p>
          </>
        )}
      </section>
    </div>
  )
}
