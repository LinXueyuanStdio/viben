import { NotificationItem } from "@/components/content/notification-item"
import { AuthorCard } from "@/components/content/author-card"
import { SectionHead } from "@/components/content/section-head"
import { VibenTabs, VibenTabsList, VibenTabsTrigger, VibenTabsContent } from "@/components/ui/viben-tabs"
import { Button } from "@/components/ui/button"
import { mockNotifications } from "@/lib/mock/notifications"
import { mockAuthors } from "@/lib/mock/authors"
import { CheckCheck } from "lucide-react"

const NOTIF_TABS = ["全部", "评论", "关注", "订阅"]

export default function NotificationsPage() {
  return (
    <div className="grid gap-[14px]" style={{ gridTemplateColumns: "minmax(0, 1fr) 330px" }}>
      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <SectionHead title="通知" />
          <Button variant="ghost" size="sm" className="gap-1.5">
            <CheckCheck className="size-3.5" />
            全部已读
          </Button>
        </div>
        <VibenTabs defaultValue="全部">
          <VibenTabsList>
            {NOTIF_TABS.map((tab) => (
              <VibenTabsTrigger key={tab} value={tab}>{tab}</VibenTabsTrigger>
            ))}
          </VibenTabsList>
          {NOTIF_TABS.map((tab) => (
            <VibenTabsContent key={tab} value={tab} className="mt-2">
              <div className="grid gap-2">
                {mockNotifications.map((item, i) => (
                  <NotificationItem key={i} data={item} />
                ))}
              </div>
            </VibenTabsContent>
          ))}
        </VibenTabs>
      </div>
      <aside className="grid gap-3 content-start">
        <div className="rounded-[10px] border border-border p-2.5 grid gap-2">
          <div className="font-bold text-sm">通知设置</div>
          <label className="flex items-center gap-2 text-[13px] text-muted-foreground cursor-pointer">
            <input type="checkbox" defaultChecked className="rounded" />
            页面更新
          </label>
          <label className="flex items-center gap-2 text-[13px] text-muted-foreground cursor-pointer">
            <input type="checkbox" defaultChecked className="rounded" />
            评论回复
          </label>
        </div>
        <SectionHead title="订阅作者" />
        {mockAuthors.slice(0, 2).map((author, i) => (
          <AuthorCard key={i} data={author} />
        ))}
      </aside>
    </div>
  )
}
