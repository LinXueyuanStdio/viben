import { Suspense } from 'react';
import { Sparkles } from 'lucide-react';
import { SkillsGrid } from '@/components/skills/skills-grid';
import { SkillsFilters } from '@/components/skills/skills-filters';
import { SearchInput } from '@/components/shared/search-input';
import { PageHeader } from '@/components/shared/page-header';

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
  }>;
}

export default async function SkillsPage({ searchParams }: SkillsPageProps) {
  const params = await searchParams;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Sparkles}
        title="Skills Marketplace"
        subtitle="Discover and install AI agent skills and capabilities"
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SearchInput
          placeholder="Search skills..."
          defaultValue={params.q}
        />
        <SkillsFilters
          category={params.category}
          type={params.type}
          sort={params.sort}
        />
      </div>

      <Suspense fallback={<SkillsGridSkeleton />}>
        <SkillsGrid searchParams={params} />
      </Suspense>
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
