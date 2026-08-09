import { Suspense } from 'react';
import { MarketTabBar } from '@/components/layout/market-tab-bar';
import { McpGrid } from '@/components/mcp/mcp-grid';
import { McpFilters } from '@/components/mcp/mcp-filters';
import { McpPageHeader } from '@/components/mcp/mcp-page-header';
import { McpSearchInput } from '@/components/mcp/mcp-search-input';
import { getSession } from '@/lib/auth/cookies';
import { SourceTabs, type McpSource } from '@/components/mcp/source-tabs';
import { OfficialServerGrid } from '@/components/mcp/official-server-grid';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata = {
  title: 'MCP 市场',
  description: '浏览和安装 Viben 社区的 MCP 服务包',
  alternates: {
    canonical: `${APP_URL}/mcp-market`,
  },
  openGraph: {
    title: 'MCP 市场',
    description: '浏览和安装 Viben 社区的 MCP 服务包',
    url: `${APP_URL}/mcp-market`,
    type: "website",
  },
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
      <MarketTabBar />
      <McpPageHeader userSlug={session?.userSlug} />

      {/* Source Tabs */}
      <SourceTabs source={source} />

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <McpSearchInput source={source} defaultValue={params.q} />
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
          <McpGrid searchParams={params} isAuthenticated={!!session} />
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
