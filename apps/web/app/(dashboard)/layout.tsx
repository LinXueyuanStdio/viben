import { Suspense } from "react"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { UrlErrorToast } from "@/components/layout/url-error-toast"
import { getSession } from "@/lib/auth/cookies"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  return (
    <DashboardShell isLoggedIn={!!session}>
      <Suspense>
        <UrlErrorToast />
      </Suspense>
      {children}
    </DashboardShell>
  )
}
