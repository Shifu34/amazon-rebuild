import { requireUser } from '@/lib/auth'

// Sign-in gate outside loading.tsx's Suspense boundary, so signed-out visitors get a real redirect instead of a streamed one.
export default async function OrdersListLayout({ children }: { children: React.ReactNode }) {
  await requireUser('/orders')
  return children
}
