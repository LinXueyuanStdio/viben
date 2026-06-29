"use client"

import { useSearchParams } from "next/navigation"
import { SearchResultCard } from "./search-result-card"
import { SearchFilterSidebar } from "./search-filter-sidebar"
import { SearchEmpty } from "./search-empty"
import type { SearchResultData } from "./search-result-card"

// Mock 数据 — 后续接入 API
const mockFilters = [
  { label: "页面", count: 45, value: "page" },
  { label: "作者", count: 23, value: "author" },
  { label: "动态", count: 31, value: "moment" },
  { label: "论文", count: 14, value: "paper" },
]

const mockResults: SearchResultData[] = [
  {
    id: "1",
    type: "page",
    title: "插件发布清单",
    description: "如何高效发布你的第一个MCP插件",
    author: { name: "兮尘" },
    stats: { views: 12345, likes: 328, comments: 128 },
    url: "/read/xichen/plugin-checklist",
  },
  {
    id: "2",
    type: "page",
    title: "MCP 插件开发完全指南",
    description: "从零开始构建你的MCP服务",
    author: { name: "周一诺" },
    stats: { views: 8543, likes: 256, comments: 89 },
    url: "/read/yinuo/mcp-guide",
  },
  {
    id: "3",
    type: "page",
    title: "Viben 入门教程",
    description: "快速上手Viben的完整指南",
    author: { name: "林越" },
    stats: { views: 6543, likes: 198, comments: 67 },
    url: "/read/linyue/viben-intro",
  },
]

const EMPTY_TRIGGERS = ["不存在", "空", "无结果", "zzzz"]

export function SearchPageContent() {
  const searchParams = useSearchParams()
  const query = searchParams.get("q") || "插件发布清单"
  const activeFilter = searchParams.get("filter") || ""
  const isEmpty = EMPTY_TRIGGERS.includes(query.toLowerCase())

  if (isEmpty) {
    return <SearchEmpty query={query} />
  }

  return (
    <div className="grid gap-4">
      {/* 摘要栏 */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground font-bold">
          &ldquo;{query}&rdquo; 的搜索结果 共 113 条
        </p>
        {/* 排序按钮（占位） */}
      </div>

      <div className="grid grid-cols-[200px_1fr] gap-4 items-start">
        {/* 筛选侧栏 */}
        <SearchFilterSidebar filters={mockFilters} activeFilter={activeFilter} />

        {/* 结果列表 */}
        <div className="grid gap-2">
          {mockResults.map((result) => (
            <SearchResultCard key={result.id} data={result} />
          ))}
        </div>
      </div>
    </div>
  )
}
