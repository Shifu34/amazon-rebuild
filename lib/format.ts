export const toCents = (dollars: number) => Math.round(dollars * 100)

/** @deprecated US dollars only: use formatDollars(dollars, currency, rate) from lib/region (docs/region.md) */
export const usd = (dollars: number) => dollars.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
/** @deprecated US dollars only: use formatMoney(cents, currency, rate) from lib/region (docs/region.md) */
export const usdCents = (cents: number) => usd(cents / 100)

/** @deprecated US dollars only: use moneyParts(cents, currency, rate) from lib/region */
// Amazon renders prices as $ + whole + superscript cents
export function priceParts(dollars: number) {
  const [whole, fraction] = dollars.toFixed(2).split('.')
  return { whole: Number(whole).toLocaleString('en-US'), fraction }
}

export const compactCount = (n: number) => (n >= 1000 ? `${Math.floor(n / 1000)}K+` : `${n}+`)

export const plural = (n: number, word: string) => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`

export const longDate = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
export const shortDate = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
export const fullDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
