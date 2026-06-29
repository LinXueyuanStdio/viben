import type { RankItemData } from "@/components/content/rank-item"

export const mockRankItems: RankItemData[] = [
  {
    rank: 1,
    cover: "linear-gradient(135deg, #0891b2, #06b6d4)",
    title: "Transformer 架构详解：从 Attention 到应用",
    description: "全面解析 Transformer 的编码器-解码器架构与自注意力机制",
    delta: "+12%",
    author: { name: "李明", fallbackText: "李" },
    stats: { views: 23400, likes: 2340, comments: 456 },
    score: 9847,
    scoreLabel: "热度",
  },
  {
    rank: 2,
    cover: "linear-gradient(135deg, #7c3aed, #a855f7)",
    title: "React Server Components 完全指南",
    description: "深入理解 RSC 数据流、缓存策略与性能优化",
    delta: "+8%",
    author: { name: "王小红", fallbackText: "王" },
    stats: { views: 18700, likes: 1820, comments: 321 },
    score: 7623,
    scoreLabel: "热度",
  },
  {
    rank: 3,
    cover: "linear-gradient(135deg, #059669, #10b981)",
    title: "Rust 异步编程：从入门到实践",
    description: "掌握 Future trait、async/await 和 Tokio 运行时",
    delta: "+15%",
    author: { name: "张伟", fallbackText: "张" },
    stats: { views: 15200, likes: 1560, comments: 278 },
    score: 5891,
    scoreLabel: "热度",
  },
]
