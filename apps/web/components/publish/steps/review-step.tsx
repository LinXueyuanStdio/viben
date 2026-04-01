'use client';

import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Server, Zap, File, Tag, Package } from 'lucide-react';
import type { PackageMetadata, PackageType } from '../publish-wizard';

interface ReviewStepProps {
  packageType: PackageType;
  metadata: PackageMetadata;
  file: File | null;
}

export function ReviewStep({ packageType, metadata, file }: ReviewStepProps) {
  const { t } = useTranslation();

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div
          className={`rounded-lg p-3 ${
            packageType === 'mcp' ? 'bg-primary/10' : 'bg-yellow-500/10'
          }`}
        >
          {packageType === 'mcp' ? (
            <Server className="h-8 w-8 text-primary" />
          ) : (
            <Zap className="h-8 w-8 text-yellow-500" />
          )}
        </div>
        <div>
          <h2 className="text-2xl font-bold">{metadata.name}</h2>
          <p className="text-muted-foreground">
            {packageType === 'mcp' ? t('publish.packageType.mcpServer') : t('publish.packageType.skill')} • v{metadata.version}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4" />
            {t('publish.review.packageDetails')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium">{t('publish.review.slug')}</p>
              <p className="text-sm text-muted-foreground">{metadata.slug}</p>
            </div>
            <div>
              <p className="text-sm font-medium">{t('publish.review.category')}</p>
              <p className="text-sm text-muted-foreground capitalize">
                {metadata.category.replace(/-/g, ' ')}
              </p>
            </div>
            {packageType === 'mcp' && (
              <>
                <div>
                  <p className="text-sm font-medium">{t('publish.review.transport')}</p>
                  <Badge variant="secondary">{metadata.transport}</Badge>
                </div>
                <div>
                  <p className="text-sm font-medium">{t('publish.review.entryPoint')}</p>
                  <code className="text-xs">{metadata.entryPoint || t('publish.review.notSet')}</code>
                </div>
              </>
            )}
            {packageType === 'skill' && (
              <div>
                <p className="text-sm font-medium">{t('publish.review.skillType')}</p>
                <Badge variant="secondary">{metadata.skillType}</Badge>
              </div>
            )}
          </div>

          <div>
            <p className="text-sm font-medium">{t('publish.review.description')}</p>
            <p className="text-sm text-muted-foreground">{metadata.description}</p>
          </div>

          {metadata.tags.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">{t('publish.review.tags')}</p>
              <div className="flex flex-wrap gap-2">
                {metadata.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    <Tag className="mr-1 h-3 w-3" />
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {file && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <File className="h-4 w-4" />
              {t('publish.review.packageFile')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-muted p-2">
                  <File className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatSize(file.size)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
        <p className="text-sm text-yellow-600 dark:text-yellow-400">
          {t('publish.review.warning')}
        </p>
      </div>
    </div>
  );
}
