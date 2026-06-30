'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { McpCard } from '@/components/mcp/mcp-card';
import { SkillCard } from '@/components/skills/skill-card';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface DbMcpPackage {
  id: string;
  name: string;
  slug: string;
  version: string;
  description: string | null;
  category: string | null;
  transport: string;
  bookmarksCount: number;
  downloads: number;
  ratingAvg: number;
  [key: string]: unknown;
}

interface DbSkillPackage {
  id: string;
  name: string;
  slug: string;
  version: string;
  description: string | null;
  category: string | null;
  skillType: string;
  bookmarksCount: number;
  downloads: number;
  ratingAvg: number;
  [key: string]: unknown;
}

interface ProfilePackagesProps {
  userId: string;
}

export function ProfilePackages({ userId }: ProfilePackagesProps) {
  const { t } = useTranslation();
  const [mcps, setMcps] = useState<DbMcpPackage[]>([]);
  const [skills, setSkills] = useState<DbSkillPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPackages = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/users/me/packages');
      if (response.ok) {
        const data = await response.json();
        setMcps(data.mcps || []);
        setSkills(data.skills || []);
      } else {
        setError(t('profile.packages.failedToLoad'));
      }
    } catch {
      setError(t('profile.packages.failedToLoad'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <button
          onClick={fetchPackages}
          className="mt-2 text-sm text-primary hover:underline"
        >
          {t('profile.packages.tryAgain')}
        </button>
      </div>
    );
  }

  const hasPackages = mcps.length > 0 || skills.length > 0;

  if (!hasPackages) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-lg text-muted-foreground">
          {t('profile.packages.noPackagesYet')}
        </p>
        <Button className="mt-4" asChild>
          <Link href="/publish">
            <Plus className="mr-2 h-4 w-4" />
            {t('profile.packages.publishPackage')}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {mcps.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold">{t('profile.packages.mcpPackages')}</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mcps.map((pkg) => (
              <McpCard
                key={pkg.id}
                package={{
                  id: pkg.id,
                  name: pkg.name,
                  slug: pkg.slug,
                  version: pkg.version,
                  description: pkg.description,
                  category: pkg.category,
                  transport: pkg.transport,
                  bookmarksCount: pkg.bookmarksCount,
                  downloadsCount: pkg.downloads,
                  ratingAvg: pkg.ratingAvg,
                  author: null,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {skills.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold">{t('profile.packages.skills')}</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {skills.map((pkg) => (
              <SkillCard
                key={pkg.id}
                package={{
                  id: pkg.id,
                  name: pkg.name,
                  slug: pkg.slug,
                  version: pkg.version,
                  description: pkg.description,
                  category: pkg.category,
                  skillType: pkg.skillType,
                  bookmarksCount: pkg.bookmarksCount,
                  downloadsCount: pkg.downloads,
                  ratingAvg: pkg.ratingAvg,
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
