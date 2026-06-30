import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { PageEditor } from "@/components/pages/page-editor"

export const dynamic = "force-dynamic"

export default async function NewPagePage() {
  const session = await getSession()

  if (!session?.userId) {
    redirect("/login")
  }

  return <PageEditor userSlug={session.userSlug} />
}
