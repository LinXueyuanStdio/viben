import { redirect } from "next/navigation"
import { eq, and } from "drizzle-orm"
import { getSession } from "@/lib/auth"
import { db, publishedPages } from "@/lib/db"
import { PageEditor } from "@/components/pages/page-editor"
import type { PageEditorInitialData } from "@/components/pages/page-editor"

export const dynamic = "force-dynamic"

interface EditPageProps {
  searchParams: Promise<{ page_id?: string }>
}

export default async function EditPagePage({ searchParams }: EditPageProps) {
  const session = await getSession()

  if (!session?.userId) {
    redirect("/login")
  }

  const { page_id } = await searchParams

  if (!page_id) {
    redirect("/pages/new")
  }

  const page = await db.query.publishedPages.findFirst({
    where: and(
      eq(publishedPages.userId, session.userId),
      eq(publishedPages.uid, page_id),
    ),
  })

  if (!page) {
    redirect("/pages/new")
  }

  const initialData: PageEditorInitialData = {
    pageId: page.uid,
    title: page.title,
    uid: page.uid,
    description: page.description ?? "",
    html: page.html,
    visibility: (page.visibility as "public" | "unlisted" | "private") ?? "public",
    tags: (page.tags as string[]) ?? [],
    coverUrl: page.coverUrl,
  }

  return <PageEditor userSlug={session.userSlug} initialData={initialData} />
}
