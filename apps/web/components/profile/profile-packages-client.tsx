'use client';

import { useTranslation } from 'react-i18next';
import { McpCard } from '@/components/mcp/mcp-card';
import { SkillCard } from '@/components/skills/skill-card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';

// Using generic types to accept the database result and map to card props
interface DbMcpPackage {
  id: string;
  name: string;
  slug: string;
  version: string;
  description: string | null;
  category: string | null;
  transport: string;
  favoritesCount: number;
  downloads: number;
  ratingAvg: number;
  // Additional optional fields from DB
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
  favoritesCount: number;
  downloads: number;
  ratingAvg: number;
  // Additional optional fields from DB
  [key: string]: unknown;
}

interface ProfilePackagesClientProps {
  mcps: DbMcpPackage[];
  skills: DbSkillPackage[];
}

export function ProfilePackagesClient({ mcps, skills }: ProfilePackagesClientProps) {
  const { t } = useTranslation();
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
                  favoritesCount: pkg.favoritesCount,
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
                  favoritesCount: pkg.favoritesCount,
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
