'use client';

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Package, Tag, Server } from 'lucide-react';

interface McpSidebarProps {
  package: {
    id: string;
    slug: string;
    version: string;
    transport: string;
    entryPoint: string;
    license: string | null;
    category: string | null;
    dependencies: string[] | null;
    createdAt: Date;
    updatedAt: Date;
  };
}

export function McpSidebar({ package: pkg }: McpSidebarProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('marketplace.installation')}</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
            <code>{pkg.entryPoint}</code>
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('marketplace.details')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              {t('marketplace.version')}
            </span>
            <Badge variant="secondary">{pkg.version}</Badge>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Server className="h-4 w-4" />
              {t('marketplace.transport')}
            </span>
            <Badge variant="outline">{pkg.transport}</Badge>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Tag className="h-4 w-4" />
              {t('marketplace.license')}
            </span>
            <span>{pkg.license || 'MIT'}</span>
          </div>

          {pkg.category && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                {t('marketplace.category')}
              </span>
              <span>{pkg.category}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {t('marketplace.published')}
            </span>
            <span>{pkg.createdAt.toLocaleDateString()}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {t('marketplace.updated')}
            </span>
            <span>{pkg.updatedAt.toLocaleDateString()}</span>
          </div>
        </CardContent>
      </Card>

      {pkg.dependencies && pkg.dependencies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('marketplace.dependencies')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {pkg.dependencies.map((dep) => (
                <Badge key={dep} variant="outline">
                  {dep}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
