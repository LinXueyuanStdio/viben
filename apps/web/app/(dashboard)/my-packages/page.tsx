import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getSession } from '@/lib/auth';
import { db, mcpPackages, skillPackages } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { PackageSearch, Package, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata = {
  title: 'My Packages',
};

export default async function MyPackagesPage() {
  const session = await getSession();

  if (!session?.userId) {
    redirect('/login');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Packages</h1>
          <p className="text-muted-foreground">
            Manage your published MCP servers and skills.
          </p>
        </div>
        <Button asChild>
          <Link href="/publish">Publish New Package</Link>
        </Button>
      </div>

      <Suspense fallback={<PackagesListSkeleton />}>
        <PackagesList userId={session.userId} />
      </Suspense>
    </div>
  );
}

async function PackagesList({ userId }: { userId: string }) {
  const [mcps, skills] = await Promise.all([
    db.query.mcpPackages.findMany({
      where: eq(mcpPackages.authorId, userId),
      columns: {
        id: true,
        name: true,
        description: true,
        status: true,
        downloadsCount: true,
        favoritesCount: true,
        createdAt: true,
      },
      orderBy: (packages, { desc }) => [desc(packages.createdAt)],
    }),
    db.query.skillPackages.findMany({
      where: eq(skillPackages.authorId, userId),
      columns: {
        id: true,
        name: true,
        description: true,
        status: true,
        downloadsCount: true,
        favoritesCount: true,
        createdAt: true,
      },
      orderBy: (packages, { desc }) => [desc(packages.createdAt)],
    }),
  ]);

  const hasPackages = mcps.length > 0 || skills.length > 0;

  if (!hasPackages) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
        <div className="rounded-full bg-muted p-4">
          <PackageSearch className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">No packages yet</h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          You haven&apos;t published any packages yet. Start by publishing your
          first MCP server or skill.
        </p>
        <Button asChild className="mt-4">
          <Link href="/publish">Publish Your First Package</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* MCP Packages Section */}
      {mcps.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">MCP Servers</h2>
            <Badge variant="secondary">{mcps.length}</Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mcps.map((pkg) => (
              <PackageCard
                key={pkg.id}
                package={pkg}
                href={`/mcp/${pkg.id}`}
              />
            ))}
          </div>
        </section>
      )}

      {/* Skills Section */}
      {skills.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Skills</h2>
            <Badge variant="secondary">{skills.length}</Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {skills.map((pkg) => (
              <PackageCard
                key={pkg.id}
                package={pkg}
                href={`/skills/${pkg.id}`}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

interface PackageCardProps {
  package: {
    id: string;
    name: string;
    description: string | null;
    status: string | null;
    downloadsCount: number;
    favoritesCount: number;
  };
  href: string;
}

function PackageCard({ package: pkg, href }: PackageCardProps) {
  const status = pkg.status ?? 'draft';
  const statusColor =
    status === 'approved' || status === 'featured'
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      : status === 'pending'
        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
        : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';

  return (
    <Link href={href}>
      <Card className="h-full transition-colors hover:border-primary/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-1 text-base">{pkg.name}</CardTitle>
            <span
              className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}
            >
              {status}
            </span>
          </div>
          {pkg.description && (
            <CardDescription className="line-clamp-2">
              {pkg.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{pkg.downloadsCount.toLocaleString()} downloads</span>
            <span>{pkg.favoritesCount.toLocaleString()} favorites</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function PackagesListSkeleton() {
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 h-7 w-32 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-lg border bg-muted"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
