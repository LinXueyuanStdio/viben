import { db, mcpPackages, skillPackages } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { McpCard } from '@/components/mcp/mcp-card';
import { SkillCard } from '@/components/skills/skill-card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';

interface ProfilePackagesProps {
  userId: string;
}

export async function ProfilePackages({ userId }: ProfilePackagesProps) {
  const [mcps, skills] = await Promise.all([
    db.query.mcpPackages.findMany({
      where: eq(mcpPackages.authorId, userId),
      orderBy: (pkg, { desc }) => [desc(pkg.createdAt)],
      limit: 10,
    }),
    db.query.skillPackages.findMany({
      where: eq(skillPackages.authorId, userId),
      orderBy: (pkg, { desc }) => [desc(pkg.createdAt)],
      limit: 10,
    }),
  ]);

  const hasPackages = mcps.length > 0 || skills.length > 0;

  if (!hasPackages) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-lg text-muted-foreground">
          You haven&apos;t published any packages yet
        </p>
        <Button className="mt-4" asChild>
          <Link href="/publish">
            <Plus className="mr-2 h-4 w-4" />
            Publish a Package
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {mcps.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold">MCP Packages</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mcps.map((pkg) => (
              <McpCard
                key={pkg.id}
                package={{
                  ...pkg,
                  author: null,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {skills.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold">Skills</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {skills.map((pkg) => (
              <SkillCard
                key={pkg.id}
                package={{
                  ...pkg,
                  author: null,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
