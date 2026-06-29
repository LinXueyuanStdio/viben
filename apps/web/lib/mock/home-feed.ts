import type { FeedCardData } from "@/components/content/feed-card"

export const mockHomeFeed: FeedCardData[] = [
  {
    head: {
      fallbackText: "李",
      name: "李明",
      handle: "@liming",
      kind: "更新",
      timeAgo: "2小时前",
    },
    text: "Transformer 架构详解已更新至第三章，新增了关于多头注意力机制的详细推导和可视化分析。",
    attachment: {
      cover: "linear-gradient(135deg, #0891b2, #06b6d4)",
      title: "Transformer 架构详解：从 Attention 到应用",
      authorName: "李明",
      timeAgo: "2天前更新",
      stats: { views: 23400, comments: 456 },
    },
    actions: { views: 3400, likes: 0, comments: 89, bookmarks: 156 },
  },
  {
    head: {
      fallbackText: "王",
      name: "王小红",
      handle: "@xiaohong",
      kind: "发布",
      timeAgo: "5小时前",
    },
    text: "发布了全新的 React Server Components 完全指南，涵盖 RSC 的数据流、缓存策略和与客户端组件的混合使用。",
    attachment: {
      cover: "linear-gradient(135deg, #7c3aed, #a855f7)",
      title: "React Server Components 完全指南",
      authorName: "王小红",
      timeAgo: "新发布",
      stats: { views: 5200, comments: 134 },
    },
    actions: { views: 5200, likes: 0, comments: 134, bookmarks: 289 },
  },
  {
    head: {
      fallbackText: "张",
      name: "张伟",
      handle: "@zhangwei",
      kind: "转发",
      timeAgo: "8小时前",
      source: "研究组",
    },
    text: "这篇关于分布式一致性的文章写得很好，推荐给大家阅读。Paxos 和 Raft 的比较非常清晰。",
    attachment: {
      cover: "linear-gradient(135deg, #059669, #10b981)",
      title: "分布式系统一致性协议比较",
      authorName: "张伟",
      timeAgo: "1周前",
      stats: { views: 15200, comments: 234 },
    },
    actions: { views: 1800, likes: 0, comments: 45, bookmarks: 67 },
  },
  {
    head: {
      fallbackText: "赵",
      name: "赵丽",
      handle: "@zhaoli",
      kind: "收藏",
      timeAgo: "12小时前",
    },
    text: "收藏了这篇设计系统实战文章，里面的 Figma 到代码工作流值得反复学习。",
    actions: { views: 890, likes: 0, comments: 12, bookmarks: 34 },
  },
  {
    head: {
      fallbackText: "陈",
      name: "陈刚",
      handle: "@chengang",
      kind: "评论",
      timeAgo: "1天前",
    },
    text: "关于 TypeScript 类型体操，我认为最重要的是理解分布式条件类型和 infer 关键字的使用场景。",
    attachment: {
      cover: "linear-gradient(135deg, #2563eb, #3b82f6)",
      title: "TypeScript 类型体操进阶",
      authorName: "陈刚",
      timeAgo: "6天前",
      stats: { views: 6700, comments: 89 },
    },
    actions: { views: 1200, likes: 0, comments: 34, bookmarks: 45 },
  },
]
