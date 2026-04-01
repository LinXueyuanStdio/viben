'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Layers,
  Lock,
  Globe,
  GitFork,
  Heart,
  Package,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

interface CollectionHeaderProps {
  collection: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    isPublic: boolean;
    itemCount: number;
    forksCount: number;
    forkedFromId: string | null;
    favoritesCount: number;
    owner: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    };
  };
  itemCount: number;
  isOwner: boolean;
  isLoggedIn: boolean;
}

export function CollectionHeader({
  collection,
  itemCount,
  isOwner,
  isLoggedIn,
}: CollectionHeaderProps) {
  const { t } = useTranslation('collections');
  const router = useRouter();
  const [isForking, setIsForking] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleFork() {
    setIsForking(true);
    try {
      const res = await fetch(`/api/collections/${collection.id}/fork`, {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error(t('failedToFork'));
      }

      const { collection: forked } = await res.json();
      toast.success(t('forkedSuccess'));
      router.push(`/collections/${forked.id}`);
      router.refresh();
    } catch {
      toast.error(t('failedToFork'));
    } finally {
      setIsForking(false);
    }
  }

  async function handleDelete() {
    if (!confirm(t('deleteConfirm'))) {
      return;
    }

    setIsDeleting(true);
    try {
      await fetch(`/api/collections/${collection.id}`, {
        method: 'DELETE',
      });
      toast.success(t('deletedSuccess'));
      router.push('/collections');
      router.refresh();
    } catch {
      toast.error(t('failedToDelete'));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-purple-500/10">
            <Layers className="h-8 w-8 text-purple-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{collection.name}</h1>
              <Badge variant={collection.isPublic ? 'secondary' : 'outline'}>
                {collection.isPublic ? (
                  <>
                    <Globe className="mr-1 h-3 w-3" />
                    {t('public')}
                  </>
                ) : (
                  <>
                    <Lock className="mr-1 h-3 w-3" />
                    {t('private')}
                  </>
                )}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              @{collection.slug}
            </p>
            {collection.description && (
              <p className="mt-2 text-muted-foreground">
                {collection.description}
              </p>
            )}
            {collection.forkedFromId && (
              <p className="mt-2 text-sm text-muted-foreground">
                <GitFork className="mr-1 inline h-3 w-3" />
                {t('forkedFrom')}{' '}
                <Link
                  href={`/collections/${collection.forkedFromId}`}
                  className="text-primary hover:underline"
                >
                  {t('anotherCollection')}
                </Link>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isLoggedIn && !isOwner && collection.isPublic && (
            <Button
              variant="outline"
              onClick={handleFork}
              disabled={isForking}
            >
              {isForking ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <GitFork className="mr-2 h-4 w-4" />
              )}
              {t('fork')}
            </Button>
          )}

          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    router.push(`/collections/${collection.id}/edit`)
                  }
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  {t('edit')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-destructive"
                  disabled={isDeleting}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={collection.owner.avatarUrl || undefined} />
            <AvatarFallback>
              {collection.owner.username[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span>{t('by')} {collection.owner.displayName}</span>
        </div>
        <span className="flex items-center gap-1">
          <Package className="h-4 w-4" />
          {t('itemCount', { count: itemCount })}
        </span>
        <span className="flex items-center gap-1">
          <GitFork className="h-4 w-4" />
          {t('forksCount', { count: collection.forksCount })}
        </span>
        <span className="flex items-center gap-1">
          <Heart className="h-4 w-4" />
          {t('favoritesCount', { count: collection.favoritesCount })}
        </span>
      </div>
    </div>
  );
}
