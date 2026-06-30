import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { T } from "@/components/content/i18n-text"

export const dynamic = "force-dynamic"

export default async function NewPagePage() {
  const session = await getSession()

  if (!session?.userId) {
    redirect("/login")
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          <T tKey="nav.createPage" fallback="创建页面" />
        </h1>
        <p className="text-muted-foreground">
          页面编辑器即将推出，敬请期待。
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <p className="text-muted-foreground">
          完整页面编辑器正在开发中。您将能够创建静态 HTML 页面、Markdown 文档、代理页面等。
        </p>
      </div>
    </div>
  )
}
