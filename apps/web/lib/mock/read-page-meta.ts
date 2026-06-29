import type { PageMetaData } from "@/components/content/page-meta"

export const mockReadPageMeta: PageMetaData = {
  author: {
    name: "李明",
    fallbackText: "李",
    followerCount: 12800,
  },
  title: "Transformer 架构详解：从 Attention 到应用",
  uid: "abc123def456",
  sidePageUid: "xyz789ghi012",
  description: [
    "本文全面解析 Transformer 模型的架构设计，从自注意力机制（Self-Attention）的基本原理出发，逐步深入到多头注意力（Multi-Head Attention）、位置编码（Positional Encoding）、前馈网络（Feed-Forward Network）以及残差连接与层归一化等核心组件。",
    "文章还涵盖了 Transformer 在 NLP、CV、多模态等领域的最新应用进展，并提供完整的 PyTorch 实现代码。",
  ],
  tags: ["深度学习", "NLP", "Transformer", "注意力机制", "论文解读"],
  stats: {
    views: 23400,
    bookmarks: 890,
    date: "2025-03-15",
  },
  actions: {
    likes: 2340,
    bookmarks: 890,
    shares: 456,
  },
  chapters: [
    { number: 1, title: "引言：从 RNN 到 Attention", status: "已读" },
    { number: 2, title: "自注意力机制详解", status: "已读" },
    { number: 3, title: "多头注意力与并行化", status: "阅读中" },
    { number: 4, title: "位置编码的演变" },
    { number: 5, title: "前馈网络与残差连接" },
    { number: 6, title: "层归一化与训练技巧" },
    { number: 7, title: "Transformer 在 CV 中的应用" },
    { number: 8, title: "多模态 Transformer" },
  ],
  chapterProgress: { current: 3, total: 8 },
  recommendations: [
    {
      cover: "linear-gradient(135deg, #7c3aed, #a855f7)",
      title: "大规模预训练模型的分布式训练策略",
      description: "数据并行、模型并行与流水线并行",
      authorName: "王小红",
      stats: { views: 12000, likes: 980 },
    },
    {
      cover: "linear-gradient(135deg, #059669, #10b981)",
      title: "注意力机制的数学原理",
      description: "从点积到缩放点积的完整推导",
      authorName: "张伟",
      stats: { views: 8900, likes: 670 },
    },
  ],
}
