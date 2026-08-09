import dynamic from "next/dynamic"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { getSession } from "@/lib/auth/cookies"

const UrlErrorToast = dynamic(
  () => import("@/components/layout/url-error-toast").then((m) => ({ default: m.UrlErrorToast })),
  { ssr: false },
)

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  return (
    <DashboardShell isLoggedIn={!!session}>
      <UrlErrorToast />
      {children}
    </DashboardShell>
  )
}
