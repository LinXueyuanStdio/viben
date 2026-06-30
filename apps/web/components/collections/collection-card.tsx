'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Layers, Lock, Bookmark, GitFork, Package } from 'lucide-react';

interface CollectionCardProps {
  collection: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    isPublic: boolean;
    itemCount: number;
    forksCount: number;
    bookmarksCount: number;
    owner: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    };
  };
  isOwner?: boolean;
}

export function CollectionCard({ collection, isOwner }: CollectionCardProps) {
  const { t } = useTranslation('collections');

  return (
    <Link href={`/collections/${collection.id}`}>
      <div className="group flex h-full flex-col rounded-lg border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/50">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
              <Layers className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold group-hover:text-primary">
                  {collection.name}
                </h3>
                {!collection.isPublic && (
                  <Lock className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                @{collection.slug}
              </p>
            </div>
          </div>
          {isOwner && <Badge variant="outline">{t('owner')}</Badge>}
        </div>

        <p className="mt-3 flex-1 text-sm text-muted-foreground line-clamp-2">
          {collection.description || t('noDescription')}
        </p>

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarImage src={collection.owner.avatarUrl || undefined} />
              <AvatarFallback>
                {collection.owner.username[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span>{collection.owner.username}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              {collection.itemCount}
            </span>
            <span className="flex items-center gap-1">
              <GitFork className="h-3 w-3" />
              {collection.forksCount}
            </span>
            <span className="flex items-center gap-1">
              <Bookmark className="h-3 w-3" />
              {collection.bookmarksCount}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
