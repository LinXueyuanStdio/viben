'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Globe, Users } from 'lucide-react';
import { cn } from '@/lib/utils/index';

/**
 * MCP source types
 */
export type McpSource = 'official' | 'community';

interface SourceTabsProps {
  source?: McpSource;
  className?: string;
}

/**
 * SourceTabs component allows switching between Official and Community MCP sources
 * Updates URL search params to persist state
 */
export function SourceTabs({ source = 'official', className }: SourceTabsProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSourceChange = (newSource: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('source', newSource);
    // Reset pagination and filters when switching source
    params.delete('page');
    params.delete('category');
    router.push(`?${params.toString()}`);
  };

  return (
    <Tabs
      value={source}
      onValueChange={handleSourceChange}
      className={cn('w-full', className)}
    >
      <TabsList className="grid w-full max-w-[400px] grid-cols-2">
        <TabsTrigger value="official" className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          <span>{t('marketplace.sourceOfficial')}</span>
        </TabsTrigger>
        <TabsTrigger value="community" className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span>{t('marketplace.sourceCommunity')}</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

/**
 * Badge to indicate the source of an MCP package
 */
interface SourceBadgeProps {
  source: McpSource;
  className?: string;
}

export function SourceBadge({ source, className }: SourceBadgeProps) {
  const { t } = useTranslation();

  return (
    <Badge
      variant={source === 'official' ? 'default' : 'secondary'}
      className={cn(
        'text-[10px] shrink-0',
        source === 'official' && 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-500/20',
        source === 'community' && 'bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 border-purple-500/20',
        className
      )}
    >
      {source === 'official' ? t('marketplace.badgeOfficial') : t('marketplace.badgeCommunity')}
    </Badge>
  );
}
