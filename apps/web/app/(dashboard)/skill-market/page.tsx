import { Suspense } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { MarketTabBar } from '@/components/layout/market-tab-bar';
import { SkillsGrid } from '@/components/skills/skills-grid';
import { SkillsFilters } from '@/components/skills/skills-filters';
import { SearchInput } from '@/components/shared/search-input';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { T } from '@/components/content/i18n-text';
import { getSession } from '@/lib/auth/cookies';
import { SkillSourceTabs, type SkillSource } from '@/components/skills/skill-source-tabs';
import { OfficialSkillGrid } from '@/components/skills/official-skill-grid';
import { makeOG, makeTwitter, APP_URL } from '@/lib/metadata';

export const metadata = {
  title: '技能市场',
  description: '浏览和安装 Viben 社区的技能包',
  alternates: {
    canonical: `${APP_URL}/skill-market`,
  },
  openGraph: makeOG({
    title: '技能市场',
    description: '浏览和安装 Viben 社区的技能包',
    url: `${APP_URL}/skill-market`,
    type: "website",
  }),
  twitter: makeTwitter({
    title: '技能市场',
    description: '浏览和安装 Viben 社区的技能包',
  }),
};

interface SkillsPageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    type?: string;
    sort?: string;
    page?: string;
    source?: SkillSource;
  }>;
}

export default async function SkillsPage({ searchParams }: SkillsPageProps) {
  const params = await searchParams;
  const session = await getSession();
  const source: SkillSource = params.source === 'community' ? 'community' : 'official';

  return (
    <div className="space-y-6">
      <MarketTabBar />
      <PageHeader
        icon={Sparkles}
        title={<T tKey="skillsMarket.title" fallback="技能市场" />}
        subtitle={<T tKey="skillsMarket.subtitle" fallback="发现和安装 AI 技能扩展" />}
      >
        {session && (
          <Button variant="outline" asChild>
            <Link href={`/${session.userSlug}?tab=skill`}>
              <Sparkles className="mr-2 h-4 w-4" />
              <T tKey="community.mySkills" fallback="我的技能" />
            </Link>
          </Button>
        )}
      </PageHeader>

      {/* Source Tabs */}
      <Suspense fallback={<div className="h-10 w-[400px] animate-pulse rounded-lg bg-muted" />}>
        <SkillSourceTabs source={source} />
      </Suspense>

      {/* Search and Filters */}
      <Suspense fallback={<div className="h-10 w-full max-w-sm animate-pulse rounded-lg bg-muted" />}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <SearchInput
            placeholderKey="skillsMarket.searchPlaceholder"
            defaultValue={params.q}
          />
          {source === 'community' && (
            <SkillsFilters
              category={params.category}
              type={params.type}
              sort={params.sort}
            />
          )}
        </div>
      </Suspense>

      {/* Content Grid */}
      {source === 'official' ? (
        <Suspense key={`official-${params.q ?? ''}`} fallback={<SkillsGridSkeleton />}>
          <OfficialSkillGrid searchQuery={params.q} />
        </Suspense>
      ) : (
        <Suspense key={`community-${params.q ?? ''}`} fallback={<SkillsGridSkeleton />}>
          <SkillsGrid searchParams={params} isAuthenticated={!!session} />
        </Suspense>
      )}
    </div>
  );
}

function SkillsGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="h-48 animate-pulse rounded-xl border bg-muted"
        />
      ))}
    </div>
  );
}
