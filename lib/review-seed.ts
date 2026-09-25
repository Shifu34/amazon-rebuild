// The written reviews a catalog product ships with. DummyJSON gives every product the same three canned phrases
// ("Fast shipping!", "Poor quality!"), which is too thin to summarise, filter or rank — so we grow each product a
// corpus of its own from sentence banks, seeded by its id. Same product, same reviews, on every render and deploy.
// Pure and dependency-free, so it is also the home of the histogram maths lib/reviews.ts shares with it.
import type { Review } from './catalog'

// Largest-remainder rounding: integers proportional to `weights` that add up to exactly `total`.
export function apportion(weights: number[], total: number) {
  const sum = weights.reduce((a, b) => a + b, 0) || 1
  const exact = weights.map((w) => (w / sum) * total)
  const out = exact.map(Math.floor)
  let left = total - out.reduce((a, b) => a + b, 0)
  for (const i of exact.map((x, i) => i).sort((a, b) => exact[b] - out[b] - (exact[a] - out[a]))) if (left-- > 0) out[i]++
  return out
}

// Star shares proportional to e^(t * star), with t bisected so the mean equals the average.
export function starShares(average: number) {
  const shares = (t: number) => [1, 2, 3, 4, 5].map((s) => Math.exp(t * s))
  const mean = (w: number[]) => w.reduce((a, x, i) => a + x * (i + 1), 0) / w.reduce((a, b) => a + b, 0)
  let lo = -20
  let hi = 20
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2
    if (mean(shares(mid)) < average) lo = mid
    else hi = mid
  }
  return shares(lo)
}

// A stream of deterministic draws from one seed (the catalog's noise() is a single hash; a review needs dozens).
function stream(seed: number) {
  let s = (seed * 2654435761) % 2147483647 || 1
  return () => {
    s = (s * 48271) % 2147483647
    return (s - 1) / 2147483646
  }
}

// Reviews are dated back from a fixed anchor, never from now(), so the text and dates of a product never change
// between renders or deploys. ponytail: move the anchor forward if this catalog is still running years from now.
const ANCHOR = Date.UTC(2026, 8, 1)
const SPREAD_DAYS = 550

const NAMES = [
  'Ayesha Khan', 'Daniel Brooks', 'Mariam Siddiqui', 'Tom Whitfield', 'Priya Nair', 'Jonas Bergman', 'Lena Fischer',
  'Omar Farooq', 'Sofia Ricci', 'Hannah Wells', 'Marcus Doyle', 'Yuki Tanaka', 'Claire Dubois', 'Samir Patel',
  'Grace Adeyemi', 'Peter Lindqvist', 'Nadia Haddad', 'Ryan Cole', 'Emma Novak', 'Hassan Raza', 'Julia Moreno',
  'Ben Carter', 'Ines Almeida', 'Kofi Mensah', 'Laura Kim', 'Vikram Shah', 'Anna Kowalski', 'Dylan Reeves',
  'Fatima Zahra', 'Chris Bennett', 'Mei Lin', 'Andrei Popescu', 'Rosa Delgado', 'Jack Ryland', 'Zoya Malik',
  'Elena Petrova', 'Noah Gilbert', 'Aisha Bello', 'Felix Harding', 'Camille Roy',
]

type Tone = 'praise' | 'mixed' | 'gripe'
type Bank = Record<Tone, string[]>

// Sentences every category can use: delivery, value, accuracy and whether they would buy again — four of the eight
// aspects the digest looks for, so any product with a handful of reviews has something to summarise.
const COMMON: Bank = {
  praise: [
    'Arrived well packaged and nothing was damaged.',
    'The price is fair for what you get.',
    'Matches the description and the photos exactly.',
    'Would happily recommend it to a friend.',
    'Shipping was straightforward and the box arrived sealed.',
    'Good value, and I would buy again without thinking twice.',
    'Exactly what the listing described, no surprises.',
    'Worth the money for how often I use it.',
    'Packaging was tidy and easy to open.',
    'Second one I have ordered, so clearly I recommend it.',
  ],
  mixed: [
    'Delivery took longer than I expected, but it arrived intact.',
    'Slightly pricey for what it is, though not badly so.',
    'Close enough to the description, if a little different in person.',
    'I might buy again, but I would look at alternatives first.',
    'The packaging was a bit flimsy, the item itself was fine.',
    'Fair value, nothing more and nothing less.',
  ],
  gripe: [
    'The box arrived dented and the packaging was minimal.',
    'Overpriced for the quality you actually get.',
    'The photos are flattering — it looks cheaper in person.',
    'Would not reorder, and I would not recommend it either.',
    'Not accurate to the description in a couple of ways that mattered.',
    'Not worth the money I paid for it.',
  ],
}

// Mapped from catalog categories below. Each bank leans on the aspects that category's reviewers actually raise.
const BANKS: Record<string, Bank> = {
  tech: {
    praise: [
      'Battery easily lasts a full day of heavy use.',
      'The screen is bright enough to read outdoors.',
      'Charging is quick and it does not get hot.',
      'Sound is clearer than I expected at this size.',
      'Build quality feels solid, no creaking or flex.',
      'Display colours look accurate straight out of the box.',
      'Sets up in a couple of minutes with no fuss.',
      'Handles everything I throw at it without slowing down.',
    ],
    mixed: [
      'Battery life is fine, though it drains faster on video calls.',
      'The screen is good, but the brightness struggles in direct sun.',
      'Decent sound, a little thin at high volume.',
      'Charging is slower than advertised, otherwise no complaints.',
      'Runs warm under load, never hot enough to bother me.',
      'The power button is awkwardly placed, everything else is fine.',
    ],
    gripe: [
      'Battery barely lasts half a day and charging is slow.',
      'The display has a noticeable tint along one edge.',
      'Audio distorts badly once you push the volume.',
      'Felt cheaply built and the casing had already scuffed.',
      'It heats up badly and the battery drains while idle.',
      'Stutters constantly, which at this price is hard to accept.',
    ],
  },
  beauty: {
    praise: [
      'The scent is subtle and lasts most of the day.',
      'Sits well on my skin without feeling heavy.',
      'No irritation at all, even around the eyes.',
      'The shade is very close to what is pictured.',
      'A little goes a long way, so the bottle lasts.',
      'Absorbs quickly and does not leave a residue.',
      'The pump gives a sensible amount every time.',
      'Has become the one I reach for every morning.',
    ],
    mixed: [
      'Nice on the skin, though the scent fades quickly.',
      'The shade is slightly darker than the photos suggest.',
      'Works well, but the bottle is smaller than I pictured.',
      'Pleasant texture, though it takes a while to sink in.',
      'Does what it promises, just slowly.',
      'The scent is lovely but far stronger than I expected.',
    ],
    gripe: [
      'The smell is overpowering and gave me a headache.',
      'Broke me out after two days of use.',
      'Thin, watery texture that does not sit well at all.',
      'Left my skin tight and uncomfortable.',
      'The pump jammed before I was halfway through the bottle.',
      'Nothing like the shade shown in the photos.',
    ],
  },
  grocery: {
    praise: [
      'Arrived fresh and well sealed.',
      'Tastes exactly like the one from my local shop.',
      'Good portion for the price.',
      'Packaging kept everything intact in transit.',
      'Keeps well once opened, which I was not expecting.',
      'The whole family goes through these quickly.',
      'Plenty of shelf life left when it turned up.',
      'Tastes fresh, not like something that has sat in a warehouse.',
    ],
    mixed: [
      'Fresh enough, though the date was closer than I hoped.',
      'Tastes fine, a bit sweeter than I expected.',
      'Good, though the portion is smaller than the photo suggests.',
      'Fine for everyday use, not a patch on the fresh version.',
      'Arrived intact, but the outer packaging was crushed.',
      'Perfectly decent, just not something I would seek out again.',
    ],
    gripe: [
      'Arrived close to its date and one pack had split.',
      'Stale by the time it reached me.',
      'Tastes noticeably off compared with the one from the shop.',
      'One of the packs had leaked over everything else.',
      'Nowhere near the portion size shown.',
      'Went off within days of arriving.',
    ],
  },
  home: {
    praise: [
      'Assembly took twenty minutes with the included parts.',
      'Feels sturdy and does not wobble in use.',
      'The material is heavier and nicer than I expected.',
      'Fits the corner I bought it for perfectly.',
      'Cleans up easily, which matters for daily use.',
      'Looks far more expensive than it was.',
      'Has taken daily use for months without complaint.',
    ],
    mixed: [
      'Sturdy enough, but the assembly instructions are vague.',
      'Looks good, though the size runs a little large for the space.',
      'Decent material, with a couple of rough edges.',
      'Solid once built, though two screws did not line up.',
      'Nice finish, but it marks more easily than I hoped.',
      'Does the job, though it is heavier than expected to move.',
    ],
    gripe: [
      'Wobbles badly and one of the fixings was missing.',
      'The material feels flimsy and had already chipped.',
      'Much larger than it appears in the pictures.',
      'Assembly was a nightmare and the holes did not align.',
      'The finish started peeling within a month.',
      'Arrived with a crack along one edge.',
    ],
  },
  apparel: {
    praise: [
      'True to size and the fit is flattering.',
      'The fabric is soft and has held up through several washes.',
      'The colour matches the photos closely.',
      'Comfortable enough to wear all day.',
      'Stitching looks neat and nothing has come loose.',
      'Holds its shape after washing, which is rarer than it should be.',
    ],
    mixed: [
      'Fits well, but the fabric is thinner than I expected.',
      'Sizing runs a little tight across the shoulders.',
      'Nice colour, though slightly duller in daylight.',
      'The length is fine on me, but the sleeves run long.',
      'Comfortable, though it creases if you sit for a while.',
    ],
    gripe: [
      'Sizing is way off — order at least one size up.',
      'The material feels cheap and creases the moment you sit down.',
      'A seam came loose after the second wear.',
      'Shrank noticeably in the first wash.',
      'The colour ran and marked everything else in the load.',
    ],
  },
  shoes: {
    praise: [
      'True to size and comfortable from the first wear.',
      'No rubbing at the heel, even on a long day.',
      'The sole has plenty of grip.',
      'The material has softened nicely without losing shape.',
      'Light enough to wear all day without noticing them.',
    ],
    mixed: [
      'Comfortable, but they run half a size small.',
      'Good fit, though they need a week of wearing in.',
      'The sole is sturdy, the insole could use more padding.',
      'Look smart, a little narrow across the toes.',
    ],
    gripe: [
      'Rubbed my heel raw within an hour.',
      'The sole started separating after a fortnight.',
      'Far too tight — nothing like the size I normally wear.',
      'The material creased badly straight away and looks worn out.',
    ],
  },
  accessory: {
    praise: [
      'The strap is comfortable and adjusts easily.',
      'Heavier than expected in a good way, feels well made.',
      'The size is right for everyday carry.',
      'Finish still looks new after weeks of use.',
      'Clasp is secure and has not come undone once.',
      'Gets compliments every time I wear it.',
      'The material has worn in nicely rather than worn out.',
    ],
    mixed: [
      'Looks great, though the strap is stiff at first.',
      'The size is a little smaller than the photos suggest.',
      'Well made, but the finish marks easily.',
      'Good quality, though the fastening takes practice.',
      'Lighter than I expected, which I am still deciding about.',
      'Smart enough for daily wear, not for anything formal.',
    ],
    gripe: [
      'The clasp broke within a fortnight.',
      'Plating wore off along the edges almost immediately.',
      'Far smaller than the pictures make it look.',
      'The strap tore where it meets the buckle.',
      'Turned my wrist green after a week.',
      'Feels cheaply made the moment you pick it up.',
    ],
  },
}

const GROUP: Record<string, keyof typeof BANKS> = {
  smartphones: 'tech', laptops: 'tech', tablets: 'tech', 'mobile-accessories': 'tech',
  beauty: 'beauty', 'skin-care': 'beauty', fragrances: 'beauty',
  groceries: 'grocery',
  furniture: 'home', 'home-decoration': 'home', 'kitchen-accessories': 'home',
  tops: 'apparel', 'womens-dresses': 'apparel', 'mens-shirts': 'apparel', 'womens-shoes': 'shoes', 'mens-shoes': 'shoes',
  'mens-watches': 'accessory', 'womens-watches': 'accessory', 'womens-bags': 'accessory', 'womens-jewellery': 'accessory',
  sunglasses: 'accessory', 'sports-accessories': 'accessory',
}

const HEADLINES: Record<Tone, string[]> = {
  praise: ['Exactly what I wanted', 'Better than I expected', 'Happy with this one', 'Does the job well', 'Worth it', 'No complaints', 'Would buy again', 'Solid purchase'],
  mixed: ['Good, with caveats', 'Mostly fine', 'Decent for the price', 'Almost there', 'Does the job, mostly'],
  gripe: ['Not for me', 'Disappointed', 'Expected better', 'Would not reorder', 'Save your money'],
}

const toneFor = (rating: number): Tone => (rating >= 4 ? 'praise' : rating === 3 ? 'mixed' : 'gripe')

// How many reviews a product carries: popular products accumulate more, quiet ones stay thin.
function reviewCount(p: Seedable, rand: () => number) {
  const popular = p.boughtPastMonth >= 1000 ? 6 : p.boughtPastMonth >= 200 ? 3 : 0
  const rated = p.ratingCount > 12_000 ? 4 : p.ratingCount > 4_000 ? 2 : 0
  return Math.min(20, 6 + Math.floor(rand() * 4) + popular + rated)
}

// Ratings that match the product's average: the same histogram the page shows (apportion of starShares), then nudged
// a star at a time until the mean of this small sample lands on the product's rating.
function ratingsFor(rating: number, n: number, rand: () => number) {
  const counts = apportion(starShares(rating), n)
  const list = counts.flatMap((count, i) => Array.from({ length: count }, () => i + 1))
  const mean = () => list.reduce((a, b) => a + b, 0) / list.length
  for (let i = 0; i < n * 5 && Math.abs(mean() - rating) > 0.1; i++) {
    const up = mean() < rating
    const at = list.findIndex((r) => (up ? r < 5 : r > 1))
    if (at < 0) break
    list[at] += up ? 1 : -1
  }
  // deterministic shuffle, so the stars are not ordered 1,1,2,5,5,5 down the page
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

// Deals from a shuffled copy and reshuffles once empty, so one product works through a bank before repeating a
// sentence. Picking at random instead puts "The box arrived dented" three times on the same page, which reads as fake.
function dealer<T>(list: T[], rand: () => number) {
  let deck: T[] = []
  return () => {
    if (!deck.length) {
      deck = [...list]
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1))
        ;[deck[i], deck[j]] = [deck[j], deck[i]]
      }
    }
    return deck.pop() as T
  }
}

export type Seedable = { id: number; category: string; rating: number; ratingCount: number; boughtPastMonth: number }

// One product's written reviews: a headline, one to three sentences drawn from the common and category banks, a
// reviewer, a date and a verified flag. ~70% are verified purchases, so "Verified purchases only" leaves a list behind.
export function seedReviews(p: Seedable): Review[] {
  const rand = stream(p.id)
  const bank = BANKS[GROUP[p.category] ?? 'accessory']
  // one deck per pool per product, so this product's reviews spread across a bank instead of landing on the same line
  const decks = Object.fromEntries(
    (['praise', 'mixed', 'gripe'] as Tone[]).map((tone) => [tone, { bank: dealer(bank[tone], rand), common: dealer(COMMON[tone], rand), head: dealer(HEADLINES[tone], rand) }]),
  ) as Record<Tone, { bank: () => string; common: () => string; head: () => string }>
  const names = dealer(NAMES, rand)
  return ratingsFor(p.rating, reviewCount(p, rand), rand).map((rating): Review => {
    const tone = toneFor(rating)
    const deck = decks[tone]
    // a category sentence plus a common one covers a product aspect and a shopping aspect; a third sentence adds spread.
    // The order varies: leading with the same bank sentence every time makes two reviews on one page look copy-pasted.
    const sentences = rand() < 0.5 ? [deck.bank(), deck.common()] : [deck.common(), deck.bank()]
    if (rand() < 0.45) sentences.push(rand() < 0.5 ? deck.bank() : deck.common())
    return {
      rating,
      comment: deck.head(),
      body: [...new Set(sentences)].join(' '),
      date: new Date(ANCHOR - Math.floor(rand() * SPREAD_DAYS) * 86_400_000).toISOString(),
      reviewerName: names(),
      verified: rand() < 0.7,
    }
  })
}
