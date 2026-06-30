import { db, mcpPackages, users } from '@/lib/db';
import { eq, desc, ilike, or, and, count } from 'drizzle-orm';
import { McpCard } from './mcp-card';
import { McpEmptyState } from './mcp-empty-state';
import { AnimatedGrid } from '@/components/shared/animated-grid';
import { Pagination } from '@/components/shared/pagination';

interface McpGridProps {
  searchParams: {
    q?: string;
    category?: string;
    sort?: string;
    page?: string;
  };
}

export async function McpGrid({ searchParams }: McpGridProps) {
  const { q, category, sort = 'latest', page = '1' } = searchParams;
  const limit = 12;
  const offset = (Number(page) - 1) * limit;

  // Build conditions
  const conditions = [eq(mcpPackages.isPublished, true)];
  if (q) {
    conditions.push(
      or(
        ilike(mcpPackages.name, `%${q}%`),
        ilike(mcpPackages.description, `%${q}%`)
      )!
    );
  }
  if (category) {
    conditions.push(eq(mcpPackages.category, category));
  }

  // Build order
  const orderBy =
    sort === 'popular'
      ? desc(mcpPackages.bookmarksCount)
      : sort === 'downloads'
        ? desc(mcpPackages.downloadsCount)
        : desc(mcpPackages.createdAt);

  // Query
  const packages = await db
    .select({
      id: mcpPackages.id,
      name: mcpPackages.name,
      slug: mcpPackages.slug,
      version: mcpPackages.version,
      description: mcpPackages.description,
      category: mcpPackages.category,
      transport: mcpPackages.transport,
      favoritesCount: mcpPackages.bookmarksCount,
      downloadsCount: mcpPackages.downloadsCount,
      ratingAvg: mcpPackages.ratingAvg,
      author: {
        username: users.username,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(mcpPackages)
    .leftJoin(users, eq(mcpPackages.authorId, users.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  const [totalResult] = await db
    .select({ count: count() })
    .from(mcpPackages)
    .where(and(...conditions));

  const total = totalResult?.count ?? 0;
  const totalPages = Math.ceil(total / limit);

  if (packages.length === 0) {
    return <McpEmptyState hasSearch={!!q} />;
  }

  return (
    <div className="space-y-6">
      <AnimatedGrid>
        {packages.map((pkg) => (
          <McpCard key={pkg.id} package={pkg} />
        ))}
      </AnimatedGrid>

      {totalPages > 1 && (
        <Pagination currentPage={Number(page)} totalPages={totalPages} />
      )}
    </div>
  );
}
