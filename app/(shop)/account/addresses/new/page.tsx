import type { Metadata } from 'next'
import Link from 'next/link'
import { Crumbs, MAX_ADDRESSES } from '@/components/account/ui'
import { AddressForm } from '@/components/address-form'
import { getAddresses } from '@/lib/addresses'
import { requireUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'Add a new address' }

export default async function NewAddressPage() {
  const user = await requireUser('/account/addresses/new')
  const full = (await getAddresses(user.id)).length >= MAX_ADDRESSES
  return (
    <div className="mx-auto max-w-[560px] px-4 py-6">
      <Crumbs trail={[['Your Account', '/account'], ['Your Addresses', '/account/addresses'], ['New Address']]} />
      <h1 className="mb-4 text-[28px] leading-9 font-normal">Add a new address</h1>
      {full ? (
        <p>
          You can save up to {MAX_ADDRESSES} addresses. <Link href="/account/addresses" className="link">Remove one</Link> to add another.
        </p>
      ) : (
        <AddressForm returnTo="/account/addresses?alert=saved" />
      )}
    </div>
  )
}
