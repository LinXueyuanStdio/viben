import { redirect } from "next/navigation"
import { eq, and } from "drizzle-orm"
import { getSession } from "@/lib/auth"
import { db, publishedPages, mediaAssets } from "@/lib/db"
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

  // 兼容旧数据：coverAssetId 有值但 coverUrl 未写入时，从 media asset 获取
  let coverUrl = page.coverUrl
  if (!coverUrl && page.coverAssetId) {
    const asset = await db.query.mediaAssets.findFirst({
      where: eq(mediaAssets.id, page.coverAssetId),
    })
    coverUrl = asset?.url ?? null
  }

  const initialData: PageEditorInitialData = {
    pageId: page.uid,
    title: page.title,
    uid: page.uid,
    description: page.description ?? "",
    html: page.html,
    visibility: (page.visibility as "public" | "unlisted" | "private") ?? "public",
    tags: (page.tags as string[]) ?? [],
    coverUrl,
    coverAssetId: page.coverAssetId,
  }

  return <PageEditor userSlug={session.userSlug} initialData={initialData} />
}
