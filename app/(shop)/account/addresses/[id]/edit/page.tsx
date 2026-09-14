import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Crumbs } from '@/components/account/ui'
import { AddressForm } from '@/components/address-form'
import { getAddress } from '@/lib/addresses'
import { requireUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'Edit your address' }

export default async function EditAddressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser(`/account/addresses/${id}/edit`)
  const address = await getAddress(user.id, id) // someone else's address is a 404 like a missing one
  if (!address) notFound()
  return (
    <div className="mx-auto max-w-[560px] px-4 py-6">
      <Crumbs trail={[['Your Account', '/account'], ['Your Addresses', '/account/addresses'], ['Edit Address']]} />
      <h1 className="mb-4 text-[28px] leading-9 font-normal">Edit your address</h1>
      <AddressForm address={address} returnTo="/account/addresses?alert=saved" />
    </div>
  )
}
