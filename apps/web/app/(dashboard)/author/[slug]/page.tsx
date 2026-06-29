import { ProfileHero } from "@/components/content/profile-hero"
import { PageCard } from "@/components/content/page-card"
import { NotificationItem } from "@/components/content/notification-item"
import { HistoryItem } from "@/components/content/history-item"
import { VibenTabs, VibenTabsList, VibenTabsTrigger, VibenTabsContent } from "@/components/ui/viben-tabs"
import { SectionHead } from "@/components/content/section-head"
import { mockCategoryPages } from "@/lib/mock/pages"
import { mockHistoryItems } from "@/lib/mock/history"
import { mockNotifications } from "@/lib/mock/notifications"

const AUTHOR_TABS = ["页面", "动态", "合集", "关于"]

const mockProfile = {
  fallbackText: "李",
  name: "李明",
  handle: "@liming",
  tagline: "NLP 研究员 · 前腾讯 AI Lab",
  stats: {
    followers: 12800,
    pages: 47,
    mutualFollows: 3,
  },
}

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const profile = { ...mockProfile, name: slug === "liming" ? "李明" : "作者", fallbackText: slug[0]?.toUpperCase() ?? "?" }

  return (
    <div className="grid gap-4">
      <ProfileHero data={profile} />
      <VibenTabs defaultValue="页面">
        <VibenTabsList>
          {AUTHOR_TABS.map((tab) => (
            <VibenTabsTrigger key={tab} value={tab}>{tab}</VibenTabsTrigger>
          ))}
        </VibenTabsList>

        <VibenTabsContent value="页面" className="mt-3">
          <SectionHead title="公开页面" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {mockCategoryPages.slice(0, 3).map((page, i) => (
              <PageCard key={i} data={page} variant="default" href={`/read/${page.author.name}/${i}`} />
            ))}
          </div>
        </VibenTabsContent>

        <VibenTabsContent value="动态" className="mt-3">
          <div className="grid gap-2">
            {mockNotifications.slice(0, 2).map((item, i) => (
              <NotificationItem key={i} data={item} />
            ))}
          </div>
        </VibenTabsContent>

        <VibenTabsContent value="合集" className="mt-3">
          <SectionHead title="合集" />
          <div className="grid gap-2">
            {mockHistoryItems.slice(0, 1).map((item, i) => (
              <HistoryItem key={i} data={item} href={`/read/${item.author}/${i}`} />
            ))}
            <p className="text-[13px] text-muted-foreground py-4 text-center">更多合集开发中...</p>
          </div>
        </VibenTabsContent>

        <VibenTabsContent value="关于" className="mt-3">
          <div className="max-w-[760px] text-sm text-muted-foreground leading-relaxed space-y-3">
            <p>NLP 研究员，专注于大规模语言模型的可解释性与对齐研究。曾在腾讯 AI Lab 从事自然语言处理相关工作。</p>
            <p>这里记录了我的研究笔记、论文解读和工程实践。希望通过这些内容帮助更多人理解深度学习与自然语言处理的前沿技术。</p>
          </div>
        </VibenTabsContent>
      </VibenTabs>
    </div>
  )
}
