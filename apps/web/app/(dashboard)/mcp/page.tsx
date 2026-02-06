import { Suspense } from 'react';
import Link from 'next/link';
import { Store, Package } from 'lucide-react';
import { McpGrid } from '@/components/mcp/mcp-grid';
import { McpFilters } from '@/components/mcp/mcp-filters';
import { SearchInput } from '@/components/shared/search-input';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { getSession } from '@/lib/auth/cookies';
import { SourceTabs, type McpSource } from '@/components/mcp/source-tabs';
import { OfficialServerGrid } from '@/components/mcp/official-server-grid';

export const metadata = {
  title: 'MCP Marketplace',
};

interface McpPageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    sort?: string;
    page?: string;
    source?: McpSource;
  }>;
}

export default async function McpPage({ searchParams }: McpPageProps) {
  const params = await searchParams;
  const session = await getSession();
  const source: McpSource = params.source === 'community' ? 'community' : 'official';

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Store}
        title="MCP Marketplace"
        subtitle="Discover and install Model Context Protocol servers"
      >
        {session && (
          <Button variant="outline" asChild>
            <Link href="/my-packages">
              <Package className="mr-2 h-4 w-4" />
              My MCP
            </Link>
          </Button>
        )}
      </PageHeader>

      {/* Source Tabs */}
      <SourceTabs source={source} />

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SearchInput
          placeholder={source === 'official' ? 'Search official servers...' : 'Search community packages...'}
          defaultValue={params.q}
        />
        {source === 'community' && (
          <McpFilters category={params.category} sort={params.sort} />
        )}
      </div>

      {/* Content Grid */}
      {source === 'official' ? (
        <Suspense fallback={<McpGridSkeleton />}>
          <OfficialServerGrid searchQuery={params.q} />
        </Suspense>
      ) : (
        <Suspense fallback={<McpGridSkeleton />}>
          <McpGrid searchParams={params} />
        </Suspense>
      )}
    </div>
  );
}

function McpGridSkeleton() {
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
