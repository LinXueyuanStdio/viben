import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { db, users, apiKeys } from '@/lib/db'
import { eq, count } from 'drizzle-orm'
import { AccountSettingsForm } from '@/components/profile/account-settings-form'

export const dynamic = 'force-dynamic'

export default async function SettingsAccountPage() {
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

  // Count API keys
  const keyCount = await db
    .select({ count: count() })
    .from(apiKeys)
    .where(eq(apiKeys.userId, session.userId))
    .then((r) => r[0]?.count ?? 0)

  return (
    <AccountSettingsForm
      user={{
        id: user.id,
        username: user.username,
        email: user.email,
        hasPassword: !!user.passwordHash,
        createdAt: user.createdAt?.toISOString() ?? null,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        role: user.role ?? 'user',
        keyCount,
      }}
    />
  )
}
