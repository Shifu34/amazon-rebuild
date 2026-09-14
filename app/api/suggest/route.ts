import { suggest } from '@/lib/catalog'

export function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get('q') ?? '').slice(0, 100)
  const { terms, products } = suggest(q)
  return Response.json({ terms, products: products.map(({ id, title, thumbnail, price }) => ({ id, title, thumbnail, price })) })
}
