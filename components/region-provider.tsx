'use client'

import { createContext, useContext, useMemo } from 'react'
import type { CountryCode, CurrencyCode } from '@/lib/region'

export type ClientRegion = { currency: CurrencyCode; rate: number; country: CountryCode }

const RegionContext = createContext<ClientRegion>({ currency: 'USD', rate: 1, country: 'US' })

// Rendered by the (shop) and (checkout) layouts from getRegion(), so client components can read the region.
export function RegionProvider({ currency, rate, country, children }: ClientRegion & { children: React.ReactNode }) {
  const value = useMemo(() => ({ currency, rate, country }), [currency, rate, country])
  return <RegionContext value={value}>{children}</RegionContext>
}

export const useRegion = () => useContext(RegionContext)
