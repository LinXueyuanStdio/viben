import { getSession } from "@/lib/auth/cookies"
import { notFound } from "next/navigation"
import { ReadPageServer, generateReadPageMetadata } from "@/components/pages/read-page-server"

interface PageProps {
  params: Promise<{ user_slug: string; slug: string[] }>
  searchParams: Promise<{ tab?: string }>
}

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: PageProps) {
  const { user_slug, slug } = await params
  if (slug.length < 2) return { title: "未找到" }
  return generateReadPageMetadata(user_slug, slug.join("/"), slug.map(encodeURIComponent).join("/"))
}

export default async function CatchAllPagePage({ params, searchParams }: PageProps) {
  const { user_slug, slug } = await params
  const { tab } = await searchParams

  if (slug.length < 2) notFound()

  const session = await getSession()
  const pageId = slug.join("/")
  const segmentsPath = slug.map(encodeURIComponent).join("/")

  return <ReadPageServer userSlug={user_slug} pageId={pageId} session={session} activeTab={tab ?? "read"} segmentsPath={segmentsPath} />
}
