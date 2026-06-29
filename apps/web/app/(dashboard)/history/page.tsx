import { HistoryItem } from "@/components/content/history-item"
import { SectionHead } from "@/components/content/section-head"
import { VibenTabs, VibenTabsList, VibenTabsTrigger, VibenTabsContent } from "@/components/ui/viben-tabs"
import { Pill } from "@/components/content/pill"
import { Bookmark, BookOpen, Clock } from "lucide-react"
import Link from "next/link"
import { mockHistoryItems } from "@/lib/mock/history"

const HISTORY_TABS = ["全部", "未读完", "今天"]

export default function HistoryPage() {
  return (
    <div className="grid gap-[14px]" style={{ gridTemplateColumns: "minmax(0, 1fr) 330px" }}>
      <div className="grid gap-3">
        <VibenTabs defaultValue="全部">
          <VibenTabsList>
            {HISTORY_TABS.map((tab) => (
              <VibenTabsTrigger key={tab} value={tab}>{tab}</VibenTabsTrigger>
            ))}
          </VibenTabsList>
          {HISTORY_TABS.map((tab) => (
            <VibenTabsContent key={tab} value={tab} className="mt-2">
              <div className="grid gap-2">
                {mockHistoryItems.map((item, i) => (
                  <HistoryItem key={i} data={item} href={`/read/${item.author}/${i}`} />
                ))}
              </div>
            </VibenTabsContent>
          ))}
        </VibenTabs>
      </div>
      <aside className="grid gap-3 content-start">
        <div className="grid gap-2">
          <div className="font-bold text-sm">收藏过的页面</div>
          <Link href="/read/liming/transformer" className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground">
            <Bookmark className="size-3.5" />
            <span className="truncate">Transformer 架构详解</span>
          </Link>
          <Link href="/read/xiaohong/rsc" className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground">
            <Bookmark className="size-3.5" />
            <span className="truncate">React Server Components 指南</span>
          </Link>
        </div>
        <SectionHead title="阅读队列" actionLabel="整理" actionHref="/history" />
        <div className="grid gap-2">
          <div className="flex items-center gap-2.5 rounded-[10px] border border-border p-2.5">
            <BookOpen className="size-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold truncate">今晚继续读</div>
              <div className="text-[12.5px] text-muted-foreground">3 篇未读 · ~28 分钟</div>
            </div>
            <Pill>3</Pill>
          </div>
          <div className="flex items-center gap-2.5 rounded-[10px] border border-border p-2.5">
            <Clock className="size-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold truncate">本周已完成</div>
              <div className="text-[12.5px] text-muted-foreground">7 页面 + 2 论文</div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
