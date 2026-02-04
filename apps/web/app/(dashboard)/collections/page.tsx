import { Suspense } from 'react';
import { CollectionsGrid } from '@/components/collections/collections-grid';
import { CollectionsFilters } from '@/components/collections/collections-filters';
import { CreateCollectionButton } from '@/components/collections/create-collection-button';
import { SearchInput } from '@/components/shared/search-input';
import { getSession } from '@/lib/auth/cookies';

export const metadata = {
  title: 'Collections',
};

interface CollectionsPageProps {
  searchParams: Promise<{
    q?: string;
    type?: string;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Collections</h1>
          <p className="mt-2 text-muted-foreground">
            Curated lists of MCP servers and skills
          </p>
        </div>
        {session && <CreateCollectionButton />}
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SearchInput
          placeholder="Search collections..."
          defaultValue={params.q}
        />
        <CollectionsFilters type={params.type} />
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
