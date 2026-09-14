// "Showing results for": fixes query words that match nothing in the catalog, using edit distance to catalog words.
import { CATEGORY_NAMES, products } from '@/lib/catalog'

const words = (s: string) => s.toLowerCase().normalize('NFKD').split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2)

let dictionary: string[] | undefined
const dict = () =>
  (dictionary ??= [...new Set([...Object.values(CATEGORY_NAMES), ...products.flatMap((p) => [p.title, p.brand ?? '', ...p.tags])].flatMap(words))])

function distance(a: string, b: string) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = row
  }
  return prev[b.length]
}

// ponytail: linear scan over ~1-2k catalog words per unknown word; index by length or trigram if the catalog grows 100x
export function correctSpelling(q: string): string | null {
  let changed = false
  const out = q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => {
      const bare = t.replace(/[^\p{L}\p{N}]/gu, '')
      if (bare.length < 3 || dict().some((w) => w.startsWith(bare))) return t
      const limit = bare.length > 5 ? 2 : 1
      let best = t
      let bestD = limit + 1
      for (const w of dict()) {
        if (Math.abs(w.length - bare.length) > limit) continue
        const d = distance(bare, w)
        if (d < bestD) [best, bestD] = [w, d]
      }
      if (best !== t) changed = true
      return best
    })
  return changed ? out.join(' ') : null
}
