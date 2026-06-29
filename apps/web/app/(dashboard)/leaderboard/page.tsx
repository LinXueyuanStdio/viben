import { RankItem } from "@/components/content/rank-item"
import { SectionHead } from "@/components/content/section-head"
import { VibenTabs, VibenTabsList, VibenTabsTrigger, VibenTabsContent } from "@/components/ui/viben-tabs"
import { mockRankItems } from "@/lib/mock/rank"

const RANK_TABS = ["热门页面", "新近上升", "30天"]

export default function LeaderboardPage() {
  return (
    <div className="grid gap-3">
      <SectionHead title="热门页面" />
      <VibenTabs defaultValue="热门页面">
        <VibenTabsList>
          {RANK_TABS.map((tab) => (
            <VibenTabsTrigger key={tab} value={tab}>{tab}</VibenTabsTrigger>
          ))}
        </VibenTabsList>
        {RANK_TABS.map((tab) => (
          <VibenTabsContent key={tab} value={tab} className="mt-2">
            <div className="grid gap-2">
              {mockRankItems.map((item, i) => (
                <RankItem key={i} data={item} href={`/read/${item.author.name}/${i}`} />
              ))}
            </div>
          </VibenTabsContent>
        ))}
      </VibenTabs>
    </div>
  )
}
