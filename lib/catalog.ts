// Read-only catalog: 194 DummyJSON products held in memory, plus the Amazon-style signals derived from them.
// Search, facets and sorting run in memory; at this size that is faster than any database round trip.
import raw from '@/data/products.json'

type RawProduct = (typeof raw.products)[number]

export type Review = { rating: number; comment: string; date: string; reviewerName: string }

export type Product = {
  id: number
  title: string
  description: string
  category: string
  brand: string | null
  price: number
  listPrice: number | null
  discount: number
  rating: number
  ratingCount: number
  stock: number
  tags: string[]
  images: string[]
  thumbnail: string
  warranty: string
  shipping: string
  returnPolicy: string
  weight: number
  dimensions: { width: number; height: number; depth: number }
  sku: string
  reviews: Review[]
  boughtPastMonth: number
  badge: 'best-seller' | 'amazons-choice' | null
  createdAt: string
}

export const CATEGORY_NAMES: Record<string, string> = {
  beauty: 'Beauty',
  fragrances: 'Fragrances',
  furniture: 'Furniture',
  groceries: 'Grocery & Gourmet Food',
  'home-decoration': 'Home Décor',
  'kitchen-accessories': 'Kitchen & Dining',
  laptops: 'Laptops',
  'mens-shirts': "Men's Shirts",
  'mens-shoes': "Men's Shoes",
  'mens-watches': "Men's Watches",
  'mobile-accessories': 'Cell Phone Accessories',
  motorcycle: 'Motorcycles',
  'skin-care': 'Skin Care',
  smartphones: 'Cell Phones',
  'sports-accessories': 'Sports & Outdoors',
  sunglasses: 'Sunglasses',
  tablets: 'Tablets',
  tops: "Women's Tops",
  vehicle: 'Vehicles',
  'womens-bags': "Women's Handbags",
  'womens-dresses': "Women's Dresses",
  'womens-jewellery': "Women's Jewelry",
  'womens-shoes': "Women's Shoes",
  'womens-watches': "Women's Watches",
}

export const DEPARTMENTS: { slug: string; name: string; categories: string[] }[] = [
  { slug: 'electronics', name: 'Electronics', categories: ['smartphones', 'laptops', 'tablets', 'mobile-accessories'] },
  { slug: 'home-kitchen', name: 'Home & Kitchen', categories: ['kitchen-accessories', 'furniture', 'home-decoration'] },
  { slug: 'beauty-personal-care', name: 'Beauty & Personal Care', categories: ['beauty', 'skin-care', 'fragrances'] },
  { slug: 'womens-fashion', name: "Women's Fashion", categories: ['tops', 'womens-dresses', 'womens-shoes', 'womens-bags', 'womens-jewellery', 'womens-watches'] },
  { slug: 'mens-fashion', name: "Men's Fashion", categories: ['mens-shirts', 'mens-shoes', 'mens-watches', 'sunglasses'] },
  { slug: 'grocery', name: 'Grocery', categories: ['groceries'] },
  { slug: 'sports', name: 'Sports & Outdoors', categories: ['sports-accessories'] },
  { slug: 'automotive', name: 'Automotive', categories: ['vehicle', 'motorcycle'] },
]

// hasOwn: URL input like `toString` must not resolve to Object.prototype members
export const categoryName = (slug: string) => (Object.hasOwn(CATEGORY_NAMES, slug) ? CATEGORY_NAMES[slug] : slug)
// `i` in search URLs is a department slug or a category slug, like Amazon's search-alias
export const scopeName = (slug: string): string | undefined =>
  DEPARTMENTS.find((d) => d.slug === slug)?.name ?? (Object.hasOwn(CATEGORY_NAMES, slug) ? CATEGORY_NAMES[slug] : undefined)
const inScope = (p: Product, slug: string) => DEPARTMENTS.find((d) => d.slug === slug)?.categories.includes(p.category) ?? p.category === slug

// deterministic pseudo-random in [0, 1) so derived signals are stable across renders and deploys
const noise = (n: number) => {
  const x = Math.sin(n * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

const round2 = (n: number) => Math.round(n * 100) / 100

function derive(p: RawProduct): Product {
  const discount = Math.round(p.discountPercentage)
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    category: p.category,
    brand: p.brand ?? null,
    price: p.price,
    listPrice: discount >= 5 ? round2(p.price / (1 - p.discountPercentage / 100)) : null,
    discount: discount >= 5 ? discount : 0,
    rating: Math.round(p.rating * 10) / 10,
    ratingCount: Math.round(40 + noise(p.id) ** 2 * 24000),
    stock: p.stock,
    tags: p.tags,
    images: p.images,
    thumbnail: p.thumbnail,
    warranty: p.warrantyInformation,
    shipping: p.shippingInformation,
    returnPolicy: p.returnPolicy,
    weight: p.weight,
    dimensions: p.dimensions,
    sku: p.sku,
    reviews: p.reviews.map(({ rating, comment, date, reviewerName }) => ({ rating, comment, date, reviewerName })),
    boughtPastMonth: noise(p.id + 7) < 0.55 ? [50, 100, 200, 300, 500, 1000, 2000, 5000][Math.floor(noise(p.id + 3) * 8)] : 0,
    badge: null,
    createdAt: p.meta.createdAt,
  }
}

export const products: Product[] = raw.products.map(derive)

// one Best Seller (most bought among those rated 4 or higher) and one Amazon's Choice (best rated of the rest) per category
for (const slug of Object.keys(CATEGORY_NAMES)) {
  const inCat = products.filter((p) => p.category === slug)
  const best = inCat.filter((p) => p.rating >= 4).sort((a, b) => b.boughtPastMonth - a.boughtPastMonth || b.ratingCount - a.ratingCount)[0]
  if (best) best.badge = 'best-seller'
  const choice = inCat.filter((p) => p !== best && p.stock > 0).sort((a, b) => b.rating - a.rating)[0]
  if (choice) choice.badge = 'amazons-choice'
}

const byId = new Map(products.map((p) => [p.id, p]))
export const getProduct = (id: number) => byId.get(id)

export const popularity = (p: Product) => p.boughtPastMonth * 10 + p.ratingCount * (p.rating / 5)

export type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'rating' | 'newest' | 'bestsellers'
export const SORTS: { key: SortKey; label: string }[] = [
  { key: 'featured', label: 'Featured' },
  { key: 'price-asc', label: 'Price: Low to High' },
  { key: 'price-desc', label: 'Price: High to Low' },
  { key: 'rating', label: 'Avg. Customer Review' },
  { key: 'newest', label: 'Newest Arrivals' },
  { key: 'bestsellers', label: 'Best Sellers' },
]

export type SearchParams = {
  q?: string
  category?: string
  brands?: string[]
  min?: number
  max?: number
  rating?: number
  deals?: boolean
  inStock?: boolean
  sort?: SortKey
  page?: number
  perPage?: number
}

const tokens = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean)
const stem = (t: string) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t)

// Search fields by weight, heaviest first, tokenized once per product (the catalog is static). The last word of a category or
// tag names what it is: "Cell Phone Accessories" and "phone accessories" are accessories, so "phone" there weighs like a
// description word and phones rank above their cases.
const FIELDS = new Map<number, [string[], number][]>()
function fieldsOf(p: Product) {
  let f = FIELDS.get(p.id)
  if (!f) {
    const names = [categoryName(p.category), ...p.tags].map(tokens)
    f = [
      [tokens(p.title), 5],
      [tokens(p.brand ?? ''), 4],
      [[...names.map((n) => n.at(-1) ?? ''), ...tokens(p.category)], 3],
      [[...names.flatMap((n) => n.slice(0, -1)), ...tokens(p.description)], 1],
    ]
    FIELDS.set(p.id, f)
  }
  return f
}

// every query token must prefix-match a word somewhere (a one-letter token only a whole word); title and brand hits weigh most
function score(p: Product, q: string[]): number {
  if (!q.length) return 1
  let total = 0
  for (const t of q.map(stem)) {
    const hit = fieldsOf(p).find(([words]) => words.some((w) => (t.length === 1 ? w === t : w.startsWith(t) || stem(w) === t)))
    if (!hit) return 0
    total += hit[1]
  }
  return total
}

export function search(params: SearchParams) {
  const { q = '', category, brands = [], min, max, rating, deals, inStock, sort = 'featured', page = 1, perPage = 24 } = params
  const qt = tokens(q)
  // text with no searchable words ("%") finds nothing, not everything
  const matched = q.trim() && !qt.length ? [] : products.map((p) => ({ p, s: score(p, qt) })).filter((x) => x.s > 0)

  // facets are computed before the facet's own filter is applied, so choices stay visible
  const inCategory = category ? matched.filter((x) => inScope(x.p, category)) : matched
  const passesOthers = (p: Product) =>
    (min === undefined || p.price >= min) &&
    (max === undefined || p.price <= max) &&
    (!rating || p.rating >= rating) &&
    (!deals || p.discount >= 10) &&
    (!inStock || p.stock > 0)
  const passesRest = (p: Product) => (!brands.length || (p.brand !== null && brands.includes(p.brand))) && passesOthers(p)

  const categoryCounts = new Map<string, number>()
  for (const { p } of matched) if (passesRest(p)) categoryCounts.set(p.category, (categoryCounts.get(p.category) ?? 0) + 1)
  const brandCounts = new Map<string, number>()
  for (const { p } of inCategory) if (p.brand && passesOthers(p)) brandCounts.set(p.brand, (brandCounts.get(p.brand) ?? 0) + 1)

  const results = inCategory.filter((x) => passesRest(x.p))
  const cmp: Record<SortKey, (a: (typeof results)[number], b: (typeof results)[number]) => number> = {
    featured: (a, b) => b.s - a.s || popularity(b.p) - popularity(a.p),
    'price-asc': (a, b) => a.p.price - b.p.price,
    'price-desc': (a, b) => b.p.price - a.p.price,
    rating: (a, b) => b.p.rating - a.p.rating || b.p.ratingCount - a.p.ratingCount,
    newest: (a, b) => b.p.createdAt.localeCompare(a.p.createdAt),
    bestsellers: (a, b) => b.p.boughtPastMonth - a.p.boughtPastMonth || popularity(b.p) - popularity(a.p),
  }
  results.sort(cmp[sort] ?? cmp.featured)

  const pages = Math.max(1, Math.ceil(results.length / perPage))
  const current = Math.min(Math.max(1, page), pages)
  return {
    items: results.slice((current - 1) * perPage, current * perPage).map((x) => x.p),
    total: results.length,
    page: current,
    pages,
    perPage,
    facets: {
      categories: [...categoryCounts].map(([slug, count]) => ({ slug, name: categoryName(slug), count })).sort((a, b) => b.count - a.count),
      brands: [...brandCounts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    },
  }
}

// Completions come from department, category, brand and tag names, plus each category's last word ("phones"); never product
// titles, which get their own rows.
const VOCAB = [
  ...new Set(
    [...DEPARTMENTS.map((d) => d.name), ...Object.values(CATEGORY_NAMES).flatMap((n) => [n, n.split(' ').at(-1) ?? n]), ...products.flatMap((p) => [p.brand ?? '', ...p.tags])]
      .map((s) => s.toLowerCase().trim())
      .filter((s) => s.length > 1),
  ),
]

// Query completions that contain a word starting with what was typed ("pho" → "cell phones"), or finish its last word after
// the ones before it ("apple ph" → "apple phones"); only those that find something, most results first.
export function suggest(q: string, limit = 8) {
  const qt = tokens(q)
  if (!qt.length) return { terms: [] as string[], products: [] as Product[] }
  const hits = products.map((p) => ({ p, s: score(p, qt) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || popularity(b.p) - popularity(a.p))
  const typed = q.trim().toLowerCase().replace(/\s+/g, ' ')
  const last = typed.split(' ').at(-1) ?? typed
  const head = typed.slice(0, typed.length - last.length)
  const startsWord = (v: string, s: string) => v.startsWith(s) || v.includes(` ${s}`)
  const candidates = [...VOCAB.filter((v) => startsWord(v, typed)), ...(head ? VOCAB.filter((v) => v.startsWith(last)).map((v) => head + v) : [])]
  const terms = [...new Set(candidates)]
    .map((t) => ({ t, n: search({ q: t, perPage: 1 }).total }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.t.length - b.t.length)
    .slice(0, limit)
    .map((x) => x.t)
  return { terms, products: hits.slice(0, 4).map((x) => x.p) }
}

export const inCategory = (slug: string) => products.filter((p) => p.category === slug)

export const bestSellers = (slug?: string, limit = 10) =>
  (slug ? inCategory(slug) : products).slice().sort((a, b) => b.boughtPastMonth - a.boughtPastMonth || popularity(b) - popularity(a)).slice(0, limit)

export const deals = (limit = 48) =>
  products.filter((p) => p.discount >= 10 && p.stock > 0).sort((a, b) => b.discount - a.discount).slice(0, limit)

export const related = (p: Product, limit = 12) =>
  inCategory(p.category).filter((x) => x.id !== p.id).sort((a, b) => popularity(b) - popularity(a)).slice(0, limit)

// cheap complementary picks: best sellers from sibling categories in the same department
export function boughtTogether(p: Product, limit = 2) {
  const dept = DEPARTMENTS.find((d) => d.categories.includes(p.category))
  const pool = (dept?.categories ?? [p.category]).flatMap((c) => bestSellers(c, 3)).filter((x) => x.id !== p.id && x.stock > 0)
  return pool.sort((a, b) => noise(a.id * p.id) - noise(b.id * p.id)).slice(0, limit)
}
