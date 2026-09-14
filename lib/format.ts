// Money is formatted in lib/region (formatMoney, formatDollars, moneyParts), in the shopper's or the order's currency.
export const toCents = (dollars: number) => Math.round(dollars * 100)

export const compactCount = (n: number) => (n >= 1000 ? `${Math.floor(n / 1000)}K+` : `${n}+`)

export const plural = (n: number, word: string) => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`

export const longDate = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
export const shortDate = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
export const fullDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
