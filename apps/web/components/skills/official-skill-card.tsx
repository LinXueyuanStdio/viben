'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Sparkles, Download, Star, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/index';
import { formatCount } from '@/lib/utils/format';
import { OsIcon } from '@/components/shared/os-icon';
import { SkillSourceBadge } from './skill-source-tabs';
import type { ClawhubSkillDisplay } from '@/lib/types/clawhub-registry';

interface OfficialSkillCardProps {
  skill: ClawhubSkillDisplay;
  className?: string;
}

/**
 * OfficialSkillCard displays a ClaWHub official registry skill in a card format
 * Links to the detail page
 */
export function OfficialSkillCard({
  skill,
  className,
}: OfficialSkillCardProps) {
  const { t } = useTranslation();

  const handleOpenClawhub = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(`https://clawhub.ai/skills/${skill.slug}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <Link href={`/skills/official/${encodeURIComponent(skill.slug)}`}>
      <div
        className={cn(
          'group relative flex h-full flex-col rounded-xl border bg-card p-4 transition-all duration-300',
          'hover:border-primary/30 hover:shadow-lg hover:-translate-y-1',
          skill.isSuspicious && 'opacity-75 border-amber-500/30',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Skill Icon */}
            <div className="h-10 w-10 rounded-lg shrink-0 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold group-hover:text-primary line-clamp-1">
                  {skill.name}
                </h3>
                {skill.isSuspicious && (
                  <Badge
                    variant="outline"
                    className="text-[10px] shrink-0 text-amber-500 border-amber-500/50"
                  >
                    {t('marketplace.suspicious', 'Suspicious')}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">v{skill.version}</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <SkillSourceBadge source="official" />
          </div>
        </div>

        {/* Description */}
        <p className="mt-3 flex-1 text-sm text-muted-foreground line-clamp-2">
          {skill.description || t('marketplace.noDescription', 'No description available')}
        </p>

        {/* Slug */}
        <p className="mt-2 text-xs text-muted-foreground font-mono truncate">
          {skill.slug}
        </p>

        {/* Stats & OS */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {skill.downloads > 0 && (
            <span className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              {formatCount(skill.downloads)}
            </span>
          )}
          {skill.stars > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3" />
              {formatCount(skill.stars)}
            </span>
          )}
          {skill.os && skill.os.length > 0 && (
            <div className="flex items-center gap-1">
              {skill.os.map((os) => (
                <Badge
                  key={os}
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 gap-1"
                >
                  <OsIcon os={os} />
                  {os}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Owner */}
        {skill.ownerHandle && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            {skill.ownerAvatar ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={skill.ownerAvatar}
                alt={skill.ownerName || skill.ownerHandle}
                className="h-4 w-4 rounded-full"
              />
            ) : (
              <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center text-[8px]">
                {(skill.ownerName || skill.ownerHandle).charAt(0).toUpperCase()}
              </div>
            )}
            <span>{skill.ownerName || skill.ownerHandle}</span>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1"
            onClick={handleOpenClawhub}
            title={t('marketplace.viewOnClawhub', 'View on ClaWHub')}
          >
            <ExternalLink className="h-3 w-3" />
            ClaWHub
          </Button>
          <div className="flex-1" />
          <Button
            variant="default"
            size="sm"
            className="text-xs gap-1"
            onClick={(e) => e.stopPropagation()}
            asChild
          >
            <span>
              {t('marketplace.viewDetails', 'View Details')}
              <ExternalLink className="h-3 w-3" />
            </span>
          </Button>
        </div>
      </div>
    </Link>
  );
}

/**
 * Skeleton for loading state
 */
export function OfficialSkillCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 flex-1">
          <div className="h-10 w-10 bg-muted rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-32 bg-muted rounded" />
            <div className="h-3 w-16 bg-muted rounded" />
          </div>
        </div>
        <div className="h-4 w-14 bg-muted rounded" />
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-4 w-full bg-muted rounded" />
        <div className="h-4 w-2/3 bg-muted rounded" />
      </div>
      <div className="mt-2 h-3 w-24 bg-muted rounded" />
      <div className="mt-3 flex gap-3">
        <div className="h-4 w-12 bg-muted rounded" />
        <div className="h-4 w-12 bg-muted rounded" />
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-8 w-20 bg-muted rounded" />
        <div className="flex-1" />
        <div className="h-8 w-24 bg-muted rounded" />
      </div>
    </div>
  );
}
