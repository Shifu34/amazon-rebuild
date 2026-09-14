import { FreshOnBack } from '@/components/account/fresh-on-back'

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <FreshOnBack />
    </>
  )
}
