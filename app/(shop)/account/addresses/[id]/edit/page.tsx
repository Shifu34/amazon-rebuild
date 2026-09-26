import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Crumbs } from '@/components/account/ui'
import { AddressForm } from '@/components/address-form'
import { getAddress } from '@/lib/addresses'
import { requireUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'Edit your address' }

export default async function EditAddressPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, { instructions }] = await Promise.all([params, searchParams])
  const user = await requireUser(`/account/addresses/${id}/edit`)
  const address = await getAddress(user.id, id) // someone else's address is a 404 like a missing one
  if (!address) notFound()
  return (
    <div className="mx-auto max-w-[560px] px-4 py-10">
      <Crumbs trail={[['Your Account', '/account'], ['Your Addresses', '/account/addresses'], ['Edit Address']]} />
      <h1 className="mb-6 text-[28px] leading-9">Edit your address</h1>
      <AddressForm address={address} returnTo="/account/addresses?alert=saved" openInstructions={instructions === '1'} />
    </div>
  )
}
