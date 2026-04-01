'use client';

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Server, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PackageType } from '../publish-wizard';

interface PackageTypeStepProps {
  selected: PackageType | null;
  onSelect: (type: PackageType) => void;
}

export function PackageTypeStep({ selected, onSelect }: PackageTypeStepProps) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card
        className={cn(
          'cursor-pointer transition-all hover:border-primary/50',
          selected === 'mcp' && 'border-primary ring-2 ring-primary/20'
        )}
        onClick={() => onSelect('mcp')}
      >
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Server className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{t('publish.packageType.mcpServer')}</CardTitle>
              <CardDescription>{t('publish.packageType.mcpProtocol')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('publish.packageType.mcpDescription')}
          </p>
        </CardContent>
      </Card>

      <Card
        className={cn(
          'cursor-pointer transition-all hover:border-primary/50',
          selected === 'skill' && 'border-primary ring-2 ring-primary/20'
        )}
        onClick={() => onSelect('skill')}
      >
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-yellow-500/10 p-2">
              <Zap className="h-6 w-6 text-yellow-500" />
            </div>
            <div>
              <CardTitle className="text-lg">{t('publish.packageType.skill')}</CardTitle>
              <CardDescription>{t('publish.packageType.skillExtension')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('publish.packageType.skillDescription')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
