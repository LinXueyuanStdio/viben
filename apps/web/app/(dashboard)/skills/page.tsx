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
  title: 'Skills Marketplace',
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
        title="Skills Marketplace"
        subtitle="Discover and install AI agent skills and capabilities"
      >
        {session && (
          <Button variant="outline" asChild>
            <Link href="/my-packages">
              <Sparkles className="mr-2 h-4 w-4" />
              My Skills
            </Link>
          </Button>
        )}
      </PageHeader>

      {/* Source Tabs */}
      <SkillSourceTabs source={source} />

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SearchInput
          placeholder="Search skills..."
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

      {/* Content Grid */}
      {source === 'official' ? (
        <Suspense fallback={<SkillsGridSkeleton />}>
          <OfficialSkillGrid searchQuery={params.q} />
        </Suspense>
      ) : (
        <Suspense fallback={<SkillsGridSkeleton />}>
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
