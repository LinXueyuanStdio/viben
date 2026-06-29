'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Heart, Zap, Server } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { formatRelativeTime } from '@/lib/utils';

interface FavoritePackage {
  id: string;
  type: 'mcp' | 'skill';
  name: string;
  slug: string;
  version: string;
  description: string | null;
  category: string | null;
  favoritesCount: number;
  downloadsCount: number;
  ratingAvg: number;
  transport?: string;
  skillType?: string;
  author: {
    username: string;
    avatarUrl: string | null;
  } | null;
  favoritedAt: Date;
}

export function ProfileFavorites() {
  const { t } = useTranslation();
  const [favorites, setFavorites] = useState<FavoritePackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFavorites = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/users/me/favorites');
      if (response.ok) {
        const data = await response.json();
        setFavorites(data.favorites);
      } else {
        setError(t('profile.favorites.failedToLoad'));
      }
    } catch {
      setError(t('profile.favorites.failedToLoad'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex h-24 animate-pulse rounded-xl border bg-card p-4"
          >
            <div className="h-10 w-10 rounded-lg bg-muted" />
            <div className="ml-4 flex-1 space-y-2">
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-3 w-full rounded bg-muted" />
              <div className="h-3 w-2/3 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <button
          onClick={fetchFavorites}
          className="mt-2 text-sm text-primary hover:underline"
        >
          {t('profile.favorites.tryAgain')}
        </button>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Heart className="h-12 w-12 text-muted-foreground/30" />
        <p className="mt-4 text-lg text-muted-foreground">
          {t('profile.favorites.noFavorites')}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('profile.favorites.browseMarketplace')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {favorites.map((pkg) => (
        <FavoriteCard key={`${pkg.type}-${pkg.id}`} package={pkg} />
      ))}
    </div>
  );
}

function FavoriteCard({ package: pkg }: { package: FavoritePackage }) {
  const { t } = useTranslation();
  const href = pkg.type === 'mcp' ? `/mcp-market/${pkg.id}` : `/skill-market/${pkg.id}`;

  return (
    <Link href={href}>
      <div className="group flex items-start gap-4 rounded-xl border bg-card p-4 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
          {pkg.type === 'mcp' ? (
            <Server className="h-5 w-5" />
          ) : (
            <Zap className="h-5 w-5" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold group-hover:text-primary truncate">
              {pkg.name}
            </h3>
            <Badge variant="secondary" className="text-[10px]">
              v{pkg.version}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {pkg.type === 'mcp' ? pkg.transport?.toUpperCase() : pkg.skillType}
            </Badge>
          </div>

          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {pkg.description || t('profile.favorites.noDescription')}
          </p>

          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            {pkg.author && (
              <div className="flex items-center gap-1">
                <Avatar className="h-4 w-4">
                  <AvatarImage src={pkg.author.avatarUrl || undefined} />
                  <AvatarFallback className="text-[8px]">
                    {pkg.author.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span>{pkg.author.username}</span>
              </div>
            )}
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3" />
              {pkg.favoritesCount}
            </span>
            <span className="text-muted-foreground/60">
              {t('profile.favorites.favoritedTime', { time: formatRelativeTime(pkg.favoritedAt) })}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

ProfileFavorites.displayName = 'ProfileFavorites';
