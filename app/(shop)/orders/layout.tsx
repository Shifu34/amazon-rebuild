import { FreshOnBack } from '@/components/account/fresh-on-back'

// Back after Sign Out re-checks with the server instead of showing the last shopper's orders (same as account and lists).
export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <FreshOnBack />
    </>
  )
}
