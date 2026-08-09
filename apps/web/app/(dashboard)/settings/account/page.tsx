import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { db, users } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { AccountSettingsForm } from '@/components/profile/account-settings-form'

export const dynamic = 'force-dynamic'

interface SettingsAccountPageProps {
  searchParams: Promise<{ error?: string; provider?: string }>;
}

export default async function SettingsAccountPage({ searchParams }: SettingsAccountPageProps) {
  const session = await getSession()

  if (!session?.userId) {
    redirect('/login')
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  })

  if (!user) {
    redirect('/login')
  }

  const params = await searchParams;
  const oauthError = params.error === "already_linked" && params.provider
    ? { error: "already_linked" as const, provider: params.provider }
    : null;

  return (
    <AccountSettingsForm
      user={{
        id: user.id,
        username: user.username,
        email: user.email,
        hasPassword: !!user.passwordHash,
        createdAt: user.createdAt?.toISOString() ?? null,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      }}
      oauthError={oauthError}
    />
  )
}
