import { getSession } from "@/lib/auth/cookies"
import { AppShell } from "@/components/layout/app-shell"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  return (
    <AppShell session={session}>
      {children}
    </AppShell>
  )
}
