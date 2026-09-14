import Link from 'next/link'
import { GreetingCard, ImageCard, QuadCard, SignInCard, type Tile } from '@/components/home/cards'
import { DealRail } from '@/components/home/deal'
import { Hero, type Slide } from '@/components/home/hero'
import { ranked } from '@/components/home/scope'
import { ProductCarousel } from '@/components/product-carousel'
import { getUser } from '@/lib/auth'
import { bestSellers, deals, getProduct, related, type Product } from '@/lib/catalog'
import { query } from '@/lib/db'

const top = (category: string) => bestSellers(category, 1)[0] as Product | undefined

// one tile per category, pictured by its best seller (or by `pick` when given)
function categoryTiles(labels: Record<string, string>, href: (slug: string) => string, pick = top): Tile[] {
  return Object.entries(labels).flatMap(([slug, label]) => {
    const p = pick(slug) ?? top(slug)
    return p ? [{ label, href: href(slug), image: p.thumbnail }] : []
  })
}

// Views are written by the product page. A failed read only hides the personalized rows, like Amazon's silent widgets.
async function recentlyViewed(userId: string): Promise<Product[]> {
  const rows = await query<{ product_id: number }>(
    'select product_id from browsing_history where user_id = $1 order by viewed_at desc limit 20',
    [userId],
  ).catch(() => [])
  return rows.flatMap((r) => getProduct(r.product_id) ?? [])
}

export default async function Home() {
  const user = await getUser()
  const viewed = user ? await recentlyViewed(user.id) : []
  const seen = new Set(viewed.map((p) => p.id))
  const allDeals = deals(Infinity)
  const dealIn = (category: string) => allDeals.find((p) => p.category === category)
  const inspired = [...new Set(viewed.slice(0, 6).flatMap((p) => related(p, 8)))].filter((p) => !seen.has(p.id)).slice(0, 20)
  const viewedCategories = new Set(viewed.map((p) => p.category))
  // deals in categories they browse first, then the biggest discounts
  const forYou = [...new Set([...allDeals.filter((p) => viewedCategories.has(p.category) && !seen.has(p.id)), ...allDeals])].slice(0, 5)
  const homeImages = (categories: string[]) => categories.flatMap((c) => top(c)?.thumbnail ?? [])

  const slides: Slide[] = [
    ...(allDeals.length
      ? [{ kicker: "Today's Deals", title: `Up to ${allDeals[0].discount}% off top picks`, blurb: `${allDeals.length} limited time deals across every department`, cta: 'Shop deals', href: '/deals', images: allDeals.slice(0, 3).map((p) => p.thumbnail), tone: 'teal' as const }]
      : []),
    { kicker: 'Electronics', title: 'Upgrade your tech', blurb: 'Phones, laptops and tablets, ranked by what shoppers buy', cta: 'See Best Sellers', href: '/bestsellers/electronics', images: homeImages(['laptops', 'smartphones', 'tablets']), tone: 'violet' },
    { kicker: 'Home & Kitchen', title: 'Make home your favorite place', blurb: 'Cookware, furniture and décor shoppers love', cta: 'Shop Home & Kitchen', href: '/s?i=home-kitchen', images: homeImages(['kitchen-accessories', 'furniture', 'home-decoration']), tone: 'peach' },
    { kicker: "Women's Fashion", title: 'Fresh looks for the new season', blurb: 'Dresses, bags and shoes to mix and match', cta: 'Shop the looks', href: '/s?i=womens-fashion', images: homeImages(['womens-dresses', 'womens-bags', 'womens-shoes']), tone: 'rose' },
  ]
  const sports = top('sports-accessories')
  const grocery = top('groceries')
  const homeTiles = categoryTiles({ 'kitchen-accessories': 'Kitchen & Dining', furniture: 'Furniture', 'home-decoration': 'Home Décor' }, (c) => `/s?i=${c}`)
  // picture the Best Sellers tile with a product the category tiles don't already show
  const homeBest = ranked('home-kitchen', 10).find((p) => !homeTiles.some((t) => t.image === p.thumbnail))

  return (
    <div className="bg-page">
      <h1 className="sr-only">nile home</h1>
      <Hero slides={slides} />

      {/* overflow-x-clip: sr-only prices inside the shared carousels are positioned outside its scroll box and would widen the page */}
      <div className="relative z-10 mx-auto max-w-[1500px] space-y-5 overflow-x-clip px-3 pt-4 sm:px-5 lg:-mt-[330px] lg:pt-0">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <QuadCard
            title="Shop deals in Electronics"
            tiles={categoryTiles({ smartphones: 'Cell Phones', laptops: 'Laptops', tablets: 'Tablets', 'mobile-accessories': 'Accessories' }, (c) => (dealIn(c) ? `/deals?i=${c}` : `/bestsellers/${c}`), dealIn)}
            link={{ label: 'See all deals', href: '/deals?i=electronics' }}
          />
          <QuadCard
            title="Top categories in Home & Kitchen"
            tiles={[...homeTiles, ...(homeBest ? [{ label: 'Best Sellers', href: '/bestsellers/home-kitchen', image: homeBest.thumbnail }] : [])]}
            link={{ label: 'Explore all products in Home & Kitchen', href: '/s?i=home-kitchen' }}
          />
          <QuadCard
            className="lg:max-xl:hidden"
            title="Refresh your wardrobe"
            tiles={categoryTiles({ tops: 'Tops', 'womens-dresses': 'Dresses', 'womens-shoes': 'Shoes', 'womens-bags': 'Handbags' }, (c) => `/s?i=${c}`)}
            link={{ label: "Shop Women's Fashion", href: '/s?i=womens-fashion' }}
          />
          {user ? (
            <GreetingCard className="max-sm:order-first" name={user.name.split(' ')[0]} deal={forYou[0]} />
          ) : (
            <SignInCard className="max-sm:order-first" deal={allDeals[3] ?? allDeals[0]} />
          )}
        </div>

        <DealRail products={allDeals.slice(0, 20)} />
        {viewed.length > 0 && <ProductCarousel title="Keep shopping for" products={viewed} href="/history" />}
        <ProductCarousel title="Best Sellers in Home & Kitchen" products={ranked('home-kitchen', 20)} href="/bestsellers/home-kitchen" />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {user && forYou.length > 1 ? (
            <QuadCard title="Deals for you" tiles={forYou.slice(1, 5).map((p) => ({ label: p.title, href: `/dp/${p.id}`, image: p.thumbnail }))} link={{ label: 'See all deals', href: '/deals' }} />
          ) : (
            <QuadCard
              title="Beauty & personal care"
              tiles={categoryTiles({ 'skin-care': 'Skin Care', fragrances: 'Fragrances', 'womens-jewellery': 'Jewelry', 'womens-watches': 'Watches' }, (c) => `/s?i=${c}`)}
              link={{ label: 'See more in Beauty', href: '/s?i=beauty-personal-care' }}
            />
          )}
          <QuadCard
            title="Men's fashion essentials"
            tiles={categoryTiles({ 'mens-shirts': 'Shirts', 'mens-shoes': 'Shoes', 'mens-watches': 'Watches', sunglasses: 'Sunglasses' }, (c) => `/s?i=${c}`)}
            link={{ label: "Shop Men's Fashion", href: '/s?i=mens-fashion' }}
          />
          {sports && <ImageCard title="Get game ready" image={sports.images[0] ?? sports.thumbnail} href="/s?i=sports" link="Shop Sports & Outdoors" />}
          {grocery && <ImageCard className="lg:max-xl:hidden" title="Stock up on groceries" image={grocery.images[0] ?? grocery.thumbnail} href="/s?i=grocery" link="Shop Grocery" />}
        </div>

        {inspired.length > 0 && <ProductCarousel title="Inspired by your browsing history" products={inspired} />}
        <ProductCarousel title="Best Sellers in Electronics" products={ranked('electronics', 20)} href="/bestsellers/electronics" />
        <ProductCarousel title="Best Sellers in Beauty & Personal Care" products={ranked('beauty-personal-care', 20)} href="/bestsellers/beauty-personal-care" />
      </div>

      <section aria-labelledby="home-bottom" className="mt-6 border-y border-line bg-white px-4 py-6 text-center">
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
