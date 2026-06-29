import type { NotificationItemData } from "@/components/content/notification-item"
import { Bell, MessageCircle, UserPlus, FileText } from "lucide-react"

export const mockNotifications: NotificationItemData[] = [
  {
    type: "update",
    icon: FileText,
    title: "《Transformer 架构详解》已更新至第三章",
    author: "李明",
    detail: "新增多头注意力机制的详细推导",
    timeAgo: "2小时前",
    action: { label: "查看", variant: "arrow", href: "/read/liming/transformer" },
  },
  {
    type: "notification",
    icon: MessageCircle,
    title: "王小红 评论了你的页面",
    author: "王小红",
    detail: "《Rust 异步编程》",
    timeAgo: "5小时前",
    action: { label: "查看", variant: "arrow", href: "/read/zhangwei/rust-async" },
  },
  {
    type: "notification",
    icon: UserPlus,
    title: "陈刚 关注了你",
    timeAgo: "8小时前",
    action: { label: "关注", variant: "follow" },
  },
  {
    type: "update",
    icon: Bell,
    title: "你订阅的「前端开发周刊」发布了新内容",
    detail: "本周精选 12 篇文章",
    timeAgo: "1天前",
    action: { label: "已订阅", variant: "subscribed" },
  },
  {
    type: "notification",
    icon: MessageCircle,
    title: "赵丽 回复了你的评论",
    author: "赵丽",
    detail: "《设计系统实战》",
    timeAgo: "1天前",
    action: { label: "已读", variant: "read" },
  },
]
