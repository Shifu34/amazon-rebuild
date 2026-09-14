import { randomUUID } from 'node:crypto'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth-form'
import { DemoButton } from '@/components/demo-button'
import { getUser } from '@/lib/auth'
import { resolveReturnTo } from '../return-to'

export const metadata: Metadata = { title: 'Sign in' }

export default async function SignInPage({ searchParams }: PageProps<'/ap/signin'>) {
  const returnTo = await resolveReturnTo((await searchParams).return_to)
  if (await getUser()) redirect(returnTo)
  return (
    <>
      <AuthForm returnTo={returnTo} start="email" />
      <DemoButton token={randomUUID()} />
    </>
  )
}
