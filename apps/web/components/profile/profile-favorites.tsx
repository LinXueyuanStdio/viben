'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Bookmark, BookmarkX, X, Zap, Server, Search, Package, Heart, CheckSquare, Square } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn, formatRelativeTime } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface FavoritePackage {
  id: string;
  type: 'mcp' | 'skill';
  name: string;
  slug: string;
  version: string;
  description: string | null;
  category: string | null;
  bookmarksCount: number;
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

type TypeFilter = 'all' | 'mcp' | 'skill';
type SortOption = 'latest' | 'name' | 'downloads';

const ITEM_KEY_SEPARATOR = '::';

function getItemKey(type: string, id: string): string {
  return `${type}${ITEM_KEY_SEPARATOR}${id}`;
}

export function ProfileFavorites() {
  const { t } = useTranslation();
  const [favorites, setFavorites] = useState<FavoritePackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sort, setSort] = useState<SortOption>('latest');

  // Batch selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);

  // Removing state for animations
  const [removingKeys, setRemovingKeys] = useState<Set<string>>(new Set());
  const [removedSnapshots, setRemovedSnapshots] = useState<Map<string, FavoritePackage>>(new Map());

  const PAGE_SIZE = 20;

  // Fetch first page
  const fetchFavorites = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/users/me/favorites?limit=${PAGE_SIZE}`);
      if (response.ok) {
        const data = await response.json();
        setFavorites(data.favorites);
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      } else {
        setError(t('profile.favorites.failedToLoad'));
      }
    } catch {
      setError(t('profile.favorites.failedToLoad'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  // Fetch next page
  const fetchMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), cursor: nextCursor });
      const response = await fetch(`/api/users/me/favorites?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setFavorites((prev) => [...prev, ...data.favorites]);
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      }
    } catch (error) {
      console.error('Failed to load more favorites:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextCursor, isLoadingMore]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  // Unfavorite single item
  const unfavoriteItem = useCallback(async (pkg: FavoritePackage): Promise<boolean> => {
    const apiPath = pkg.type === 'mcp'
      ? `/api/mcp/${pkg.id}/bookmark`
      : `/api/skill/${pkg.id}/favorite`;

    try {
      const response = await fetch(apiPath, { method: 'POST' });
      return response.ok;
    } catch (error) {
      console.error('Failed to unfavorite:', error);
      return false;
    }
  }, []);

  // Handle removing a single favorite with optimistic UI and undo
  const handleRemove = useCallback((pkg: FavoritePackage) => {
    const key = getItemKey(pkg.type, pkg.id);

    // Save snapshot for undo
    setRemovedSnapshots((prev) => {
      const next = new Map(prev);
      next.set(key, pkg);
      return next;
    });

    // Mark as removing for animation
    setRemovingKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });

    // Remove from selected
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });

    // Call API
    unfavoriteItem(pkg).then((success) => {
      // After animation delay, actually remove from list
      setTimeout(() => {
        setFavorites((prev) => prev.filter(
          (f) => getItemKey(f.type, f.id) !== key
        ));
        setRemovingKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }, 300);

      if (success) {
        toast.success(t('profile.favorites.unfavorited'), {
          action: {
            label: t('profile.favorites.undo'),
            onClick: () => {
              // Undo: re-favorite via API and add back to list
              unfavoriteItem(pkg).then(() => {
                setRemovingKeys((prev) => {
                  const next = new Set(prev);
                  next.delete(key);
                  return next;
                });
                setFavorites((prev) => {
                  const exists = prev.find((f) => getItemKey(f.type, f.id) === key);
                  if (exists) return prev;
                  return [...prev, pkg];
                });
                setRemovedSnapshots((prev) => {
                  const next = new Map(prev);
                  next.delete(key);
                  return next;
                });
              });
            },
          },
        });
      } else {
        // Restore on failure
        setRemovingKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        setRemovedSnapshots((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
        toast.error(t('profile.favorites.failedToLoad'));
      }
    });
  }, [t, unfavoriteItem]);

  // Batch unfavorite
  const handleBatchRemove = useCallback(async () => {
    const keysToRemove = Array.from(selectedKeys);
    if (keysToRemove.length === 0) return;

    // Mark all as removing
    const removingSet = new Set(keysToRemove);
    setRemovingKeys(removingSet);

    // Save snapshots for all items
    const snapshots = new Map<string, FavoritePackage>();
    const itemsToRemove: FavoritePackage[] = [];
    for (const key of keysToRemove) {
      const pkg = favorites.find((f) => getItemKey(f.type, f.id) === key);
      if (pkg) {
        snapshots.set(key, pkg);
        itemsToRemove.push(pkg);
      }
    }
    setRemovedSnapshots(snapshots);

    // Clear selection immediately
    setSelectedKeys(new Set());
    setSelectionMode(false);

    // Call API for all items concurrently
    const results = await Promise.allSettled(
      itemsToRemove.map((pkg) => unfavoriteItem(pkg))
    );

    const successCount = results.filter(
      (r) => r.status === 'fulfilled' && r.value
    ).length;

    // After animation delay, remove from list
    setTimeout(() => {
      setFavorites((prev) => prev.filter(
        (f) => !keysToRemove.includes(getItemKey(f.type, f.id))
      ));
      setRemovingKeys(new Set());
    }, 300);

    if (successCount > 0) {
      toast.success(t('profile.favorites.batchUnfavorited', { count: successCount }), {
        action: {
          label: t('profile.favorites.undo'),
          onClick: async () => {
            // Re-favorite all removed items
            await Promise.allSettled(
              itemsToRemove.map((pkg) => unfavoriteItem(pkg))
            );
            setFavorites((prev) => {
              const existing = new Set(prev.map((f) => getItemKey(f.type, f.id)));
              const toAdd = itemsToRemove.filter(
                (pkg) => !existing.has(getItemKey(pkg.type, pkg.id))
              );
              return [...prev, ...toAdd];
            });
            setRemovedSnapshots(new Map());
          },
        },
      });
    }

    setBatchConfirmOpen(false);
  }, [selectedKeys, favorites, t, unfavoriteItem]);

  // Toggle individual selection
  const toggleSelect = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Filter and sort
  const filtered = useMemo(() => {
    let result = favorites.filter((pkg) => {
      // Type filter
      if (typeFilter !== 'all' && pkg.type !== typeFilter) return false;
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        if (
          !pkg.name.toLowerCase().includes(q) &&
          !pkg.description?.toLowerCase().includes(q) &&
          !pkg.author?.username.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });

    // Sort
    switch (sort) {
      case 'name':
        result = [...result].sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'downloads':
        result = [...result].sort((a, b) => b.downloadsCount - a.downloadsCount);
        break;
      case 'latest':
      default:
        result = [...result].sort(
          (a, b) => new Date(b.favoritedAt).getTime() - new Date(a.favoritedAt).getTime()
        );
        break;
    }

    return result;
  }, [favorites, typeFilter, searchQuery, sort]);

  // Select all filtered items
  const selectAll = useCallback(() => {
    const allKeys = filtered.map((pkg) => getItemKey(pkg.type, pkg.id));
    setSelectedKeys(new Set(allKeys));
  }, [filtered]);

  // Deselect all
  const deselectAll = useCallback(() => {
    setSelectedKeys(new Set());
  }, []);

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
        <Heart className="h-16 w-16 text-muted-foreground/20" />
        <p className="mt-4 text-lg text-muted-foreground">
          {t('profile.favorites.noFavorites')}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('profile.favorites.browseMarketplace')}
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link href="/mcp-market">
              <Server className="h-4 w-4" />
              {t('profile.favorites.browseMCP')}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/skill-market">
              <Zap className="h-4 w-4" />
              {t('profile.favorites.browseSkill')}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const allFilteredKeys = filtered.map((pkg) => getItemKey(pkg.type, pkg.id));
  const selectedFilteredCount = allFilteredKeys.filter((k) => selectedKeys.has(k)).length;
  const allFilteredSelected = filtered.length > 0 && selectedFilteredCount === filtered.length;

  return (
    <div className="space-y-4">
      {/* Search and Filter Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {/* Type filter tabs */}
          <Tabs
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as TypeFilter)}
          >
            <TabsList>
              <TabsTrigger value="all" className="text-xs">
                {t('profile.favorites.allTypes')}
              </TabsTrigger>
              <TabsTrigger value="mcp" className="text-xs">
                {t('profile.favorites.typeMCP')}
              </TabsTrigger>
              <TabsTrigger value="skill" className="text-xs">
                {t('profile.favorites.typeSkill')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center gap-3">
          {/* Sort */}
          <Tabs
            value={sort}
            onValueChange={(v) => setSort(v as SortOption)}
          >
            <TabsList>
              <TabsTrigger value="latest" className="text-xs">
                {t('profile.favorites.sortLatest')}
              </TabsTrigger>
              <TabsTrigger value="name" className="text-xs">
                {t('profile.favorites.sortName')}
              </TabsTrigger>
              <TabsTrigger value="downloads" className="text-xs">
                {t('profile.favorites.sortDownloads')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('profile.favorites.search')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Batch Selection Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!selectionMode ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectionMode(true)}
              className="text-xs"
            >
              <CheckSquare className="h-4 w-4" />
              {t('profile.favorites.enterSelection')}
            </Button>
          ) : (
            <>
              <span className="text-sm text-muted-foreground">
                {t('profile.favorites.selectedCount', { count: selectedKeys.size })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={allFilteredSelected ? deselectAll : selectAll}
                className="text-xs"
              >
                {allFilteredSelected
                  ? t('profile.favorites.deselectAll')
                  : t('profile.favorites.selectAll')}
              </Button>
              {selectedKeys.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBatchConfirmOpen(true)}
                  className="text-xs"
                >
                  <X className="h-3 w-3" />
                  {t('profile.favorites.batchUnfavorite')}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectionMode(false);
                  setSelectedKeys(new Set());
                }}
                className="text-xs"
              >
                {t('profile.favorites.exitSelection')}
              </Button>
            </>
          )}
        </div>

        <span className="text-xs text-muted-foreground">
          {favorites.length} items
        </span>
      </div>

      {/* Favorites list */}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {filtered.map((pkg) => {
            const key = getItemKey(pkg.type, pkg.id);
            const isRemoving = removingKeys.has(key);

            return (
              <motion.div
                key={key}
                layout
                initial={false}
                animate={
                  isRemoving
                    ? { opacity: 0, height: 0, marginBottom: 0 }
                    : { opacity: 1, height: 'auto', marginBottom: 0 }
                }
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                <FavoriteCard
                  package={pkg}
                  selectionMode={selectionMode}
                  isSelected={selectedKeys.has(key)}
                  onToggleSelect={() => toggleSelect(key)}
                  onRemove={() => handleRemove(pkg)}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Empty filtered result */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8">
          <Package className="h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm text-muted-foreground">
            {t('profile.favorites.noFavorites')}
          </p>
        </div>
      )}

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? (
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Loading...
              </span>
            ) : (
              t('profile.favorites.loadMore')
            )}
          </Button>
        </div>
      )}

      {/* Batch Confirm Dialog */}
      <AlertDialog open={batchConfirmOpen} onOpenChange={setBatchConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('profile.favorites.batchUnfavorite')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('profile.favorites.batchUnfavoriteConfirm', {
                count: selectedKeys.size,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('profile.favorites.exitSelection')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchRemove}>
              {t('profile.favorites.batchUnfavorite')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface FavoriteCardProps {
  package: FavoritePackage;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onRemove: () => void;
}

function FavoriteCard({
  package: pkg,
  selectionMode,
  isSelected,
  onToggleSelect,
  onRemove,
}: FavoriteCardProps) {
  const { t } = useTranslation();
  const href = pkg.type === 'mcp' ? `/mcp-market/${pkg.id}` : `/skill-market/${pkg.id}`;

  const cardContent = (
    <div
      className={cn(
        'flex items-start gap-4 rounded-xl border bg-card p-4 transition-all duration-300',
        !selectionMode && 'group hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5',
        isSelected && 'border-primary ring-1 ring-primary'
      )}
    >
      {/* Selection checkbox */}
      {selectionMode && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleSelect();
          }}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center"
        >
          {isSelected ? (
            <CheckSquare className="h-5 w-5 text-primary" />
          ) : (
            <Square className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
      )}

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
            <Bookmark className="h-3 w-3" />
            {pkg.bookmarksCount}
          </span>
          <span className="text-muted-foreground/60">
            {t('profile.favorites.favoritedTime', { time: formatRelativeTime(pkg.favoritedAt) })}
          </span>
        </div>
      </div>

      {/* Unfavorite button - top right, hidden in selection mode */}
      {!selectionMode && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="flex-shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition-all duration-200 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          title={t('profile.favorites.unfavorite')}
        >
          <BookmarkX className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  if (selectionMode) {
    return cardContent;
  }

  return <Link href={href}>{cardContent}</Link>;
}

FavoriteCard.displayName = 'FavoriteCard';
ProfileFavorites.displayName = 'ProfileFavorites';
