import type { PageCardData } from "@/components/content/page-card"

export const mockFeaturedPages: PageCardData[] = [
  {
    cover: "linear-gradient(135deg, #0891b2, #06b6d4)",
    title: "Transformer 架构详解：从 Attention 到应用",
    author: { name: "李明", fallbackText: "李" },
    timeAgo: "2天前",
    stats: { views: 23400, comments: 456 },
  },
  {
    cover: "linear-gradient(135deg, #7c3aed, #a855f7)",
    title: "React Server Components 完全指南",
    author: { name: "王小红", fallbackText: "王" },
    timeAgo: "5天前",
    stats: { views: 18700, comments: 321 },
  },
  {
    cover: "linear-gradient(135deg, #059669, #10b981)",
    title: "Rust 异步编程：从入门到实践",
    author: { name: "张伟", fallbackText: "张" },
    timeAgo: "1周前",
    stats: { views: 15200, comments: 234 },
  },
]

export const mockRecommendedPages: PageCardData[] = [
  {
    cover: "linear-gradient(135deg, #ea580c, #f97316)",
    title: "设计系统实战：Figma 到代码",
    author: { name: "赵丽", fallbackText: "赵" },
    timeAgo: "3天前",
    stats: { views: 8900, comments: 145 },
  },
  {
    cover: "linear-gradient(135deg, #2563eb, #3b82f6)",
    title: "TypeScript 类型体操进阶",
    author: { name: "陈刚", fallbackText: "陈" },
    timeAgo: "6天前",
    stats: { views: 6700, comments: 89 },
  },
  {
    cover: "linear-gradient(135deg, #be185d, #ec4899)",
    title: "CSS Container Queries 实战",
    author: { name: "刘芳", fallbackText: "刘" },
    timeAgo: "4天前",
    stats: { views: 5400, comments: 67 },
  },
]

export const mockCategoryPages: PageCardData[] = [
  {
    cover: "linear-gradient(135deg, #0891b2, #06b6d4)",
    title: "大语言模型幻觉问题研究综述",
    description: "系统梳理 LLM 幻觉的类型、成因与缓解策略",
    author: { name: "李明", fallbackText: "李" },
    timeAgo: "2天前",
    stats: { views: 23400, likes: 1230, comments: 456, bookmarks: 890 },
  },
  {
    cover: "linear-gradient(135deg, #7c3aed, #a855f7)",
    title: "WebAssembly 在浏览器中的应用前景",
    description: "WASM 如何改变 Web 应用的性能边界",
    author: { name: "王小红", fallbackText: "王" },
    timeAgo: "5天前",
    stats: { views: 18700, likes: 980, comments: 321, bookmarks: 670 },
  },
  {
    cover: "linear-gradient(135deg, #059669, #10b981)",
    title: "分布式系统一致性协议比较",
    description: "Paxos vs Raft vs Zab — 共识算法的工程实践",
    author: { name: "张伟", fallbackText: "张" },
    timeAgo: "1周前",
    stats: { views: 15200, likes: 760, comments: 234, bookmarks: 450 },
  },
  {
    cover: "linear-gradient(135deg, #ea580c, #f97316)",
    title: "从零实现一个 GraphQL 服务器",
    description: "用 Rust 和 async-graphql 构建高性能 API",
    author: { name: "赵丽", fallbackText: "赵" },
    timeAgo: "3天前",
    stats: { views: 8900, likes: 430, comments: 145, bookmarks: 320 },
  },
]
