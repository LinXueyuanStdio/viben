'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Layers, Lock, Bookmark, GitFork, Package, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useToggleBookmark } from '@/hooks/use-toggle-bookmark';

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
  isAuthenticated?: boolean;
  hasBookmarked?: boolean;
}

export function CollectionCard({ collection, isOwner, isAuthenticated, hasBookmarked }: CollectionCardProps) {
  const { t } = useTranslation();

  const bookmark = useToggleBookmark({
    entityType: 'published_page',
    entityId: collection.id,
    initialBookmarked: hasBookmarked ?? false,
    initialCount: collection.bookmarksCount,
  });

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error(t('community.loginToInteract'));
      return;
    }
    bookmark.toggle().catch(() => toast.error(t('community.bookmarkFailed')));
  };

  const bookmarkElement = isAuthenticated !== undefined ? (
    <button
      onClick={handleBookmark}
      disabled={bookmark.pending}
      className={cn(
        'flex items-center gap-1 transition-colors',
        bookmark.bounce && 'animate-bounce-in',
        bookmark.bookmarked
          ? 'text-amber-500'
          : 'hover:text-primary'
      )}
    >
      {bookmark.pending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Bookmark className={cn('h-3 w-3', bookmark.bookmarked && 'fill-current')} />
      )}
      {bookmark.count}
    </button>
  ) : (
    <span className="flex items-center gap-1">
      <Bookmark className="h-3 w-3" />
      {collection.bookmarksCount}
    </span>
  );

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
          {isOwner && <Badge variant="outline">{t('collections.owner')}</Badge>}
        </div>

        <p className="mt-3 flex-1 text-sm text-muted-foreground line-clamp-2">
          {collection.description || t('collections.noDescription')}
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
            {bookmarkElement}
          </div>
        </div>
      </div>
    </Link>
  );
}
