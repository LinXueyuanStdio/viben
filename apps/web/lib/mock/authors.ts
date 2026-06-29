import type { AuthorCardData } from "@/components/content/author-card"

export const mockAuthors: AuthorCardData[] = [
  {
    fallbackText: "李",
    name: "李明",
    handle: "@liming",
    description: "NLP 研究员 · 前腾讯 AI Lab",
    pageCount: 47,
    followerCount: 12800,
    representativeWork: "Transformer 架构详解",
    mutualFollows: 3,
  },
  {
    fallbackText: "王",
    name: "王小红",
    handle: "@xiaohong",
    description: "全栈开发者 · Web 标准爱好者",
    pageCount: 32,
    followerCount: 9600,
    representativeWork: "React Server Components 指南",
    mutualFollows: 5,
  },
  {
    fallbackText: "张",
    name: "张伟",
    handle: "@zhangwei",
    description: "系统架构师 · 开源贡献者",
    pageCount: 28,
    followerCount: 7500,
  },
]
