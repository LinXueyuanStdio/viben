import { db, skillPackages, users } from '@/lib/db';
import { eq, desc, ilike, or, and, count } from 'drizzle-orm';
import { Zap } from 'lucide-react';
import { SkillCard } from './skill-card';
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
      ? desc(skillPackages.favoritesCount)
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
      favoritesCount: skillPackages.favoritesCount,
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
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Zap className="h-12 w-12 mb-4 opacity-50" />
        <h3 className="text-lg font-medium">No skills found</h3>
        {q && (
          <p className="text-sm mt-1">
            Try adjusting your search or filters
          </p>
        )}
      </div>
    );
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
