import type { HistoryItemData } from "@/components/content/history-item"

export const mockHistoryItems: HistoryItemData[] = [
  {
    cover: "linear-gradient(135deg, #0891b2, #06b6d4)",
    title: "Transformer 架构详解",
    author: "李明",
    chapter: "第3章 · 多头注意力",
    source: "首页",
    timeAgo: "2小时前",
    progress: 65,
    progressLabel: "已读 65%",
  },
  {
    cover: "linear-gradient(135deg, #7c3aed, #a855f7)",
    title: "React Server Components 完全指南",
    author: "王小红",
    chapter: "第5章 · 数据缓存",
    source: "动态",
    timeAgo: "昨天",
    progress: 32,
    progressLabel: "已读 32%",
  },
  {
    cover: "linear-gradient(135deg, #be185d, #ec4899)",
    title: "CSS Container Queries 实战",
    author: "刘芳",
    chapter: "全文",
    source: "PDF",
    timeAgo: "3天前",
    progress: 100,
    progressLabel: "已读完",
  },
  {
    cover: "linear-gradient(135deg, #ea580c, #f97316)",
    title: "设计系统实战：Figma 到代码",
    author: "赵丽",
    chapter: "第2章 · 设计 Token",
    source: "搜索",
    timeAgo: "1周前",
    progress: 18,
    progressLabel: "已读 18%",
  },
]
