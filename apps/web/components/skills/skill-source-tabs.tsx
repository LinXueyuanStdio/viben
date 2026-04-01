'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Globe, Users } from 'lucide-react';
import { cn } from '@/lib/utils/index';

/**
 * Skill source types
 */
export type SkillSource = 'official' | 'community';

interface SkillSourceTabsProps {
  source?: SkillSource;
  className?: string;
}

/**
 * SkillSourceTabs component allows switching between Official and Community skill sources
 * Updates URL search params to persist state
 */
export function SkillSourceTabs({ source = 'official', className }: SkillSourceTabsProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSourceChange = (newSource: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('source', newSource);
    // Reset pagination and filters when switching source
    params.delete('page');
    params.delete('category');
    params.delete('type');
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
          <span>{t('marketplace.sourceOfficial', 'Official')}</span>
        </TabsTrigger>
        <TabsTrigger value="community" className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span>{t('marketplace.sourceCommunity', 'Community')}</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

/**
 * Badge to indicate the source of a skill package
 */
interface SkillSourceBadgeProps {
  source: SkillSource;
  className?: string;
}

export function SkillSourceBadge({ source, className }: SkillSourceBadgeProps) {
  const { t } = useTranslation();

  return (
    <Badge
      variant={source === 'official' ? 'default' : 'secondary'}
      className={cn(
        'text-[10px] shrink-0',
        source === 'official' && 'bg-primary/10 text-primary hover:bg-primary/20 border-primary/20',
        source === 'community' && 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border-secondary',
        className
      )}
    >
      {source === 'official' ? t('marketplace.badgeOfficial', 'Official') : t('marketplace.badgeCommunity', 'Community')}
    </Badge>
  );
}
