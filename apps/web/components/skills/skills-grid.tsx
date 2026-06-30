import { db, skillPackages, users } from '@/lib/db';
import { eq, desc, ilike, or, and, count } from 'drizzle-orm';
import { SkillCard } from './skill-card';
import { SkillsEmptyState } from './skills-empty-state';
import { AnimatedGrid } from '@/components/shared/animated-grid';
import { Pagination } from '@/components/shared/pagination';

interface SkillsGridProps {
  searchParams: {
    q?: string;
    category?: string;
    type?: string;
    sort?: string;
    page?: string;
  };
}

export async function SkillsGrid({ searchParams }: SkillsGridProps) {
  const { q, category, type, sort = 'latest', page = '1' } = searchParams;
  const limit = 12;
  const offset = (Number(page) - 1) * limit;

  // Build conditions
  const conditions = [eq(skillPackages.isPublished, true)];
  if (q) {
    conditions.push(
      or(
        ilike(skillPackages.name, `%${q}%`),
        ilike(skillPackages.description, `%${q}%`)
      )!
    );
  }
  if (category) {
    conditions.push(eq(skillPackages.category, category));
  }
  if (type && ['command', 'prompt', 'agent'].includes(type)) {
    conditions.push(eq(skillPackages.skillType, type as 'command' | 'prompt' | 'agent'));
  }

  // Build order
  const orderBy =
    sort === 'popular'
      ? desc(skillPackages.bookmarksCount)
      : sort === 'downloads'
        ? desc(skillPackages.downloadsCount)
        : desc(skillPackages.createdAt);

  // Query
  const packages = await db
    .select({
      id: skillPackages.id,
      name: skillPackages.name,
      slug: skillPackages.slug,
      version: skillPackages.version,
      description: skillPackages.description,
      category: skillPackages.category,
      skillType: skillPackages.skillType,
      bookmarksCount: skillPackages.bookmarksCount,
      downloadsCount: skillPackages.downloadsCount,
      ratingAvg: skillPackages.ratingAvg,
      author: {
        username: users.username,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(skillPackages)
    .leftJoin(users, eq(skillPackages.authorId, users.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  const [totalResult] = await db
    .select({ count: count() })
    .from(skillPackages)
    .where(and(...conditions));

  const total = totalResult?.count ?? 0;
  const totalPages = Math.ceil(total / limit);

  if (packages.length === 0) {
    return <SkillsEmptyState hasSearchQuery={!!q} />;
  }

  return (
    <div className="space-y-6">
      <AnimatedGrid>
        {packages.map((pkg) => (
          <SkillCard key={pkg.id} package={pkg} />
        ))}
      </AnimatedGrid>

      {totalPages > 1 && (
        <Pagination currentPage={Number(page)} totalPages={totalPages} />
      )}
    </div>
  );
}
