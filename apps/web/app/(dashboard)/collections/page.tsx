import { Suspense } from 'react';
import Link from 'next/link';
import { Layers } from 'lucide-react';
import { CollectionsGrid } from '@/components/collections/collections-grid';
import { CollectionsFilters } from '@/components/collections/collections-filters';
import { CreateCollectionButton } from '@/components/collections/create-collection-button';
import { SearchInput } from '@/components/shared/search-input';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { T } from '@/components/content/i18n-text';
import { getSession } from '@/lib/auth/cookies';

export const metadata = {
  title: '合集',
};

interface CollectionsPageProps {
  searchParams: Promise<{
    q?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function CollectionsPage({
  searchParams,
}: CollectionsPageProps) {
  const params = await searchParams;
  const session = await getSession();

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Layers}
        title={<T tKey="collections.title" fallback="合集" />}
        subtitle={<T tKey="collections.subtitle" fallback="精选的 MCP 服务器和技能列表" />}
      >
        {session && (
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/collections?mine=true">
                <Layers className="mr-2 h-4 w-4" />
                <T tKey="community.myCollections" fallback="我的合集" />
              </Link>
            </Button>
            <CreateCollectionButton />
          </div>
        )}
      </PageHeader>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SearchInput
          placeholderKey="collections.searchInputPlaceholder"
          defaultValue={params.q}
        />
        <CollectionsFilters sort={params.sort} />
      </div>

      <Suspense fallback={<CollectionsGridSkeleton />}>
        <CollectionsGrid searchParams={params} />
      </Suspense>
    </div>
  );
}

function CollectionsGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="h-40 animate-pulse rounded-lg border bg-muted"
        />
      ))}
    </div>
  );
}
