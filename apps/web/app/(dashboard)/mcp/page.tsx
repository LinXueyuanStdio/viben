import { Suspense } from 'react';
import { Store } from 'lucide-react';
import { McpGrid } from '@/components/mcp/mcp-grid';
import { McpFilters } from '@/components/mcp/mcp-filters';
import { SearchInput } from '@/components/shared/search-input';
import { PageHeader } from '@/components/shared/page-header';

export const metadata = {
  title: 'MCP Marketplace',
};

interface McpPageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function McpPage({ searchParams }: McpPageProps) {
  const params = await searchParams;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Store}
        title="MCP Marketplace"
        subtitle="Discover and install Model Context Protocol servers"
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SearchInput
          placeholder="Search MCP packages..."
          defaultValue={params.q}
        />
        <McpFilters category={params.category} sort={params.sort} />
      </div>

      <Suspense fallback={<McpGridSkeleton />}>
        <McpGrid searchParams={params} />
      </Suspense>
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
