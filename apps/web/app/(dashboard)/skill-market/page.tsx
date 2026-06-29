import { Suspense } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { SkillsGrid } from '@/components/skills/skills-grid';
import { SkillsFilters } from '@/components/skills/skills-filters';
import { SearchInput } from '@/components/shared/search-input';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { getSession } from '@/lib/auth/cookies';
import { SkillSourceTabs, type SkillSource } from '@/components/skills/skill-source-tabs';
import { OfficialSkillGrid } from '@/components/skills/official-skill-grid';

export const metadata = {
  title: '技能市场',
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
      <PageHeader
        icon={Sparkles}
        title="技能市场"
        subtitle="发现和安装 AI 智能体技能与能力"
      >
        {session && (
          <Button variant="outline" asChild>
            <Link href="/my-packages">
              <Sparkles className="mr-2 h-4 w-4" />
              我的技能
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
            placeholder="搜索技能..."
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
          <SkillsGrid searchParams={params} />
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
