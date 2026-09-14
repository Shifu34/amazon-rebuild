import { FreshOnBack } from '@/components/account/fresh-on-back'

export default function ListsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <FreshOnBack />
    </>
  )
}
