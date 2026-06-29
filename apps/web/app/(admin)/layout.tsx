import { redirect } from "next/navigation"
import { getSession, isAdminRole } from "@/lib/auth"
import { countPendingPackages } from "@/lib/admin/stats"
import { AppShell } from "@/components/layout/app-shell"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  // 保留管理员鉴权
  if (!session || !isAdminRole(session.role)) {
    redirect("/")
  }

  const pendingPackagesCount = await countPendingPackages()

  return (
    <AppShell session={session} adminStats={{ pendingPackagesCount }}>
      {children}
    </AppShell>
  )
}
