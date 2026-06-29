import { ReadPageClient } from "./read-page-client"
import { mockReadPageMeta } from "@/lib/mock/read-page-meta"
import type { Metadata } from "next"

interface ReadPageProps {
  params: Promise<{ user_slug: string; page_id: string }>
}

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: ReadPageProps): Promise<Metadata> {
  const { user_slug, page_id } = await params
  return {
    title: `${mockReadPageMeta.title} - Viben`,
    description: mockReadPageMeta.description[0] ?? `阅读 ${user_slug}/${page_id}`,
  }
}

export default async function ReadPage({ params }: ReadPageProps) {
  const { user_slug, page_id } = await params

  return <ReadPageClient userSlug={user_slug} pageId={page_id} />
}
