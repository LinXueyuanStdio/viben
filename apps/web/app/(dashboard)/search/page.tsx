import { Suspense } from "react"
import { SearchPageContent } from "@/components/search/search-page-content"

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-[360px] flex items-center justify-center">加载中...</div>}>
      <SearchPageContent />
    </Suspense>
  )
}
