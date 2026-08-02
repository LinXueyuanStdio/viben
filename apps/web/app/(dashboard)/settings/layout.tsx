import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { SettingsSidebar } from '@/components/profile/settings-sidebar'

export const dynamic = 'force-dynamic'

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session?.userId) {
    redirect('/login')
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8">
        <SettingsSidebar />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
