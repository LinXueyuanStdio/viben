import { DashboardShell } from "@/components/layout/dashboard-shell"
import { getSession } from "@/lib/auth/cookies"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  return <DashboardShell isLoggedIn={!!session}>{children}</DashboardShell>
}
