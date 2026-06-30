'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Heart, Download, Star } from 'lucide-react';

/**
 * Format large numbers with K/M suffix
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

interface McpCardProps {
  package: {
    id: string;
    name: string;
    slug: string;
    version: string;
    description: string | null;
    category: string | null;
    transport: string;
    bookmarksCount: number;
    downloadsCount: number;
    ratingAvg: number;
    author: {
      username: string;
      avatarUrl: string | null;
    } | null;
  };
}

export function McpCard({ package: pkg }: McpCardProps) {
  const { t } = useTranslation();
  const ratingAvg = pkg.ratingAvg || 0;

  return (
    <Link href={`/mcp-market/${pkg.id}`}>
      <div className="group relative flex h-full flex-col rounded-xl border bg-card p-4 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:-translate-y-1">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold group-hover:text-primary">
              {pkg.name}
            </h3>
            <p className="text-xs text-muted-foreground">v{pkg.version}</p>
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {pkg.transport.toUpperCase()}
          </Badge>
        </div>

        <p className="mt-3 flex-1 text-sm text-muted-foreground line-clamp-2">
          {pkg.description || t('marketplace.noDescription')}
        </p>

        <div className="mt-4 flex items-center justify-between">
          {pkg.author && (
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={pkg.author.avatarUrl || undefined} />
                <AvatarFallback>
                  {pkg.author.username[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">
                {pkg.author.username}
              </span>
            </div>
          )}

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3" />
              {formatNumber(pkg.bookmarksCount)}
            </span>
            <span className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              {formatNumber(pkg.downloadsCount)}
            </span>
            {ratingAvg > 0 && (
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {ratingAvg.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
