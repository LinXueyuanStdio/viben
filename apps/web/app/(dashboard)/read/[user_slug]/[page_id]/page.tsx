import { redirect } from "next/navigation"

interface ReadPageProps {
  params: Promise<{ user_slug: string; page_id: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function ReadPage({ params, searchParams }: ReadPageProps) {
  const { user_slug, page_id } = await params
  const { tab } = await searchParams
  const query = tab ? `?tab=${encodeURIComponent(tab)}` : "?tab=read"
  redirect(`/${encodeURIComponent(user_slug)}/${encodeURIComponent(page_id)}${query}`)
}
