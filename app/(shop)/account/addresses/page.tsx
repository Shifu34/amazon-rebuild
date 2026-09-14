import type { Metadata } from 'next'
import Link from 'next/link'
import { makeDefaultAddress, removeAddress } from '@/app/actions/account'
import { ConfirmDialog } from '@/components/account/modal'
import { alertFrom, Crumbs, Notice } from '@/components/account/ui'
import { formatAddress, getAddresses, MAX_ADDRESSES } from '@/lib/addresses'
import { requireUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'Your Addresses' }

const ALERTS = { saved: 'Address saved', default: 'Default address changed', removed: 'Address removed' }

const Bar = () => <span aria-hidden className="text-line">|</span>

export default async function AddressesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser('/account/addresses')
  const [addresses, { alert }] = await Promise.all([getAddresses(user.id), searchParams])
  const notice = alertFrom(ALERTS, alert)
  const tile = 'flex h-full flex-col rounded-lg sm:min-h-[260px]'

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6">
      <Crumbs trail={[['Your Account', '/account'], ['Your Addresses']]} />
      <h1 className="mb-4 text-[28px] leading-9 font-normal">Your Addresses</h1>
      {notice && <Notice>{notice}</Notice>}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <li>
          {addresses.length < MAX_ADDRESSES ? (
            <Link href="/account/addresses/new" className={`${tile} items-center justify-center border-2 border-dashed border-[#c7c7c7] hover:bg-[#f7fafa] focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none`}>
              <span aria-hidden className="text-6xl leading-none font-light text-[#aaa]">+</span>
              <span className="mt-2 text-2xl font-bold">Add address</span>
            </Link>
          ) : (
            <div className={`${tile} items-center justify-center border-2 border-dashed border-[#c7c7c7] p-6 text-center text-muted`}>
              You can save up to {MAX_ADDRESSES} addresses. Remove one to add another.
            </div>
          )}
        </li>

        {addresses.map((a) => (
          <li key={a.id}>
            <article aria-label={`${a.isDefault ? 'Default address' : 'Address'}: ${a.fullName}`} className={`${tile} border border-line`}>
              {a.isDefault && (
                <p className="border-b border-line px-5 py-2 text-xs text-muted">
                  Default: <b className="text-ink">nile</b>
                </p>
              )}
              <div className="flex-1 px-5 py-4 text-sm leading-6 break-words">
                <p className="font-bold">{a.fullName}</p>
                <p>{a.line1}</p>
                {a.line2 && <p>{a.line2}</p>}
                <p>
                  {a.city}, {a.state} {a.zip}
                </p>
                <p>{a.country}</p>
                <p>Phone number: {a.phone}</p>
                {a.instructions ? (
                  <p className="line-clamp-2 text-muted">Delivery instructions: {a.instructions}</p>
                ) : (
                  <Link href={`/account/addresses/${a.id}/edit`} className="link">Add delivery instructions</Link>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 px-5 pb-4 text-sm">
                <Link href={`/account/addresses/${a.id}/edit`} aria-label={`Edit address for ${a.fullName}`} className="link">Edit</Link>
                <Bar />
                <ConfirmDialog label="Remove" ariaLabel={`Remove address for ${a.fullName}`} title="Confirm removal" action={removeAddress} fields={{ id: a.id }}>
                  <p className="mb-2">Remove this address from your address book?</p>
                  <p className="font-bold">{a.fullName}</p>
                  <p className="break-words">{formatAddress(a)}</p>
                </ConfirmDialog>
                {!a.isDefault && (
                  <>
                    <Bar />
                    <form action={makeDefaultAddress}>
                      <input type="hidden" name="id" value={a.id} />
                      <button type="submit" aria-label={`Set address for ${a.fullName} as default`} className="link cursor-pointer">Set as Default</button>
                    </form>
                  </>
                )}
              </div>
            </article>
          </li>
        ))}
      </ul>
    </div>
  )
}
