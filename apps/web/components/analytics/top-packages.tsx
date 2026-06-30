'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Server, Zap, Download, Bookmark } from 'lucide-react';

interface Package {
  id: string;
  name: string;
  downloadsCount: number;
  bookmarksCount: number;
}

interface TopPackagesProps {
  mcps: Package[];
  skills: Package[];
}

export function TopPackages({ mcps, skills }: TopPackagesProps) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-blue-500" />
            {t('dashboard.analytics.topMcpServers')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mcps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('dashboard.analytics.noMcpServers')}
            </p>
          ) : (
            <div className="space-y-4">
              {mcps.map((pkg, index) => (
                <div key={pkg.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground">
                      #{index + 1}
                    </span>
                    <Link
                      href={`/mcp-market/${pkg.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {pkg.name}
                    </Link>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Download className="h-3 w-3" />
                      {pkg.downloadsCount.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Bookmark className="h-3 w-3" />
                      {pkg.bookmarksCount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            {t('dashboard.analytics.topSkills')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {skills.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('dashboard.analytics.noSkills')}
            </p>
          ) : (
            <div className="space-y-4">
              {skills.map((pkg, index) => (
                <div key={pkg.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground">
                      #{index + 1}
                    </span>
                    <Link
                      href={`/skill-market/${pkg.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {pkg.name}
                    </Link>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Download className="h-3 w-3" />
                      {pkg.downloadsCount.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Bookmark className="h-3 w-3" />
                      {pkg.bookmarksCount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
