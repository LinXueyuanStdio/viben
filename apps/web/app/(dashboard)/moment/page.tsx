import { Composer } from "@/components/content/composer"
import { FeedCard } from "@/components/content/feed-card"
import { AuthorCard } from "@/components/content/author-card"
import { SectionHead } from "@/components/content/section-head"
import { VibenTabs, VibenTabsList, VibenTabsTrigger, VibenTabsContent } from "@/components/ui/viben-tabs"
import { mockHomeFeed } from "@/lib/mock/home-feed"
import { mockAuthors } from "@/lib/mock/authors"

const MOMENT_TABS = ["关注", "最新", "推荐"]

export default function MomentPage() {
  return (
    <div className="grid gap-[14px]" style={{ gridTemplateColumns: "minmax(0, 1fr) 330px" }}>
      <div className="grid gap-3">
        <div className="rounded-[12px] border border-border bg-background shadow-sm p-2.5">
          <Composer userFallbackText="你" />
        </div>
        <VibenTabs defaultValue="最新">
          <VibenTabsList>
            {MOMENT_TABS.map((tab) => (
              <VibenTabsTrigger key={tab} value={tab}>{tab}</VibenTabsTrigger>
            ))}
          </VibenTabsList>
          {MOMENT_TABS.map((tab) => (
            <VibenTabsContent key={tab} value={tab} className="mt-2">
              <div className="grid gap-2">
                {mockHomeFeed.map((feed, i) => (
                  <FeedCard key={i} data={feed} variant="rich" />
                ))}
              </div>
            </VibenTabsContent>
          ))}
        </VibenTabs>
      </div>
      <aside className="grid gap-2 content-start">
        <SectionHead title="值得关注" />
        {mockAuthors.slice(0, 1).map((author, i) => (
          <AuthorCard key={i} data={author} />
        ))}
      </aside>
    </div>
  )
}
