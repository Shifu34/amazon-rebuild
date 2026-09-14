import { bestSellers, CATEGORY_NAMES, DEPARTMENTS, products, type Product } from '@/lib/catalog'

// department or category slug -> display name. Own-property check, so '?i=toString' is not a scope.
export const scopeLabel = (slug: string | undefined) =>
  !slug ? undefined : (DEPARTMENTS.find((d) => d.slug === slug)?.name ?? (Object.hasOwn(CATEGORY_NAMES, slug) ? CATEGORY_NAMES[slug] : undefined))

export const inScope = (p: Product, slug: string) => DEPARTMENTS.find((d) => d.slug === slug)?.categories.includes(p.category) ?? p.category === slug

// ranked best sellers for a department (all its categories) or a single category
export const ranked = (slug: string, limit = 50) => bestSellers(undefined, products.length).filter((p) => inScope(p, slug)).slice(0, limit)
