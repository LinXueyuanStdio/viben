import { HeroCarousel } from "@/components/content/hero-carousel"
import { PageCard } from "@/components/content/page-card"
import { FeedCard } from "@/components/content/feed-card"
import { AuthorCard } from "@/components/content/author-card"
import { SectionHead } from "@/components/content/section-head"
import { Pill } from "@/components/content/pill"
import { Stat } from "@/components/content/stats-row"
import { Eye } from "lucide-react"
import { mockSlides } from "@/lib/mock/slides"
import { mockFeaturedPages, mockRecommendedPages } from "@/lib/mock/pages"
import { mockHomeFeed } from "@/lib/mock/home-feed"
import { mockAuthors } from "@/lib/mock/authors"

export default function HomePage() {
  return (
    <div className="grid gap-[14px]" style={{ gridTemplateColumns: "minmax(0, 1fr) 330px" }}>
      {/* Left Column */}
      <div className="grid gap-3">
        <HeroCarousel slides={mockSlides} />

        {/* 精选页面 */}
        <section>
          <SectionHead title="精选页面" actionLabel="更多" actionHref="/leaderboard" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {mockFeaturedPages.map((page, i) => (
              <PageCard key={i} data={page} variant="home" href={`/read/${page.author.name}/${i}`} />
            ))}
          </div>
        </section>

        {/* 推荐 */}
        <section>
          <SectionHead title="推荐" actionLabel="换一批" actionHref="/category" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {mockRecommendedPages.map((page, i) => (
              <PageCard key={i} data={page} variant="home" href={`/read/${page.author.name}/${i}`} />
            ))}
          </div>
        </section>

        {/* 动态 */}
        <section>
          <SectionHead title="动态" actionLabel="进入" actionHref="/moment" />
          <div className="grid gap-2">
            {mockHomeFeed.slice(0, 5).map((feed, i) => (
              <FeedCard key={i} data={feed} variant="preloaded" />
            ))}
          </div>
        </section>
      </div>

      {/* Right Sidebar */}
      <aside className="grid gap-3 content-start">
        {/* 推荐关注 */}
        <section>
          <SectionHead title="推荐关注" actionLabel="查看" actionHref="/author/liming" />
          <div className="grid gap-2">
            {mockAuthors.map((author, i) => (
              <AuthorCard key={i} data={author} />
            ))}
          </div>
        </section>

        {/* 本周上升 */}
        <section>
          <SectionHead title="本周上升" actionLabel="榜单" actionHref="/leaderboard" />
          <div className="grid gap-2">
            {mockFeaturedPages.slice(0, 2).map((page, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <Pill variant="rank">{String(i + 1).padStart(2, "0")}</Pill>
                <span className="font-['Lexend'] text-[15px] font-bold truncate flex-1">{page.title}</span>
                <Stat icon={Eye} value={page.stats.views} format />
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  )
}
