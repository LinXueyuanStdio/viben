import { PageCard } from "@/components/content/page-card"
import { AuthorCard } from "@/components/content/author-card"
import { SectionHead } from "@/components/content/section-head"
import { VibenTabs, VibenTabsList, VibenTabsTrigger, VibenTabsContent } from "@/components/ui/viben-tabs"
import { mockCategoryPages } from "@/lib/mock/pages"
import { mockAuthors } from "@/lib/mock/authors"

const CATEGORIES = ["论文", "游戏", "文章", "PPT", "视频", "漫画", "视觉小说"]

export default function CategoryPage() {
  return (
    <div className="grid gap-[14px]" style={{ gridTemplateColumns: "minmax(0, 1fr) 330px" }}>
      <div className="grid gap-3">
        <VibenTabs defaultValue="论文">
          <VibenTabsList>
            {CATEGORIES.map((cat) => (
              <VibenTabsTrigger key={cat} value={cat}>{cat}</VibenTabsTrigger>
            ))}
          </VibenTabsList>
          {CATEGORIES.map((cat) => (
            <VibenTabsContent key={cat} value={cat}>
              <SectionHead title={cat} actionLabel="换一换" actionHref="/category" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
                {mockCategoryPages.map((page, i) => (
                  <PageCard key={i} data={page} variant="default" href={`/read/${page.author.name}/${i}`} />
                ))}
              </div>
            </VibenTabsContent>
          ))}
        </VibenTabs>
      </div>
      <aside className="grid gap-2 content-start">
        <SectionHead title="相关作者" />
        {mockAuthors.slice(0, 2).map((author, i) => (
          <AuthorCard key={i} data={author} />
        ))}
      </aside>
    </div>
  )
}
