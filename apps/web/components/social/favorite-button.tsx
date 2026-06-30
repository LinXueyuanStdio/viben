'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Bookmark } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type EntityType = 'mcp' | 'skill';

interface BookmarkButtonProps {
  entityType: EntityType;
  entityId: string;
  initialBookmarked?: boolean;
  initialCount?: number;
  isAuthenticated?: boolean;
  className?: string;
}

export function BookmarkButton({
  entityType,
  entityId,
  initialBookmarked = false,
  initialCount = 0,
  isAuthenticated = false,
  className,
}: BookmarkButtonProps) {
  const { t } = useTranslation();
  const [isBookmarked, setIsBookmarked] = useState(initialBookmarked);
  const [count, setCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const snapshotRef = useRef(initialCount);
  const loadingRef = useRef(false);

  // Sync from props when data changes externally, skip during in-flight mutations
  useEffect(() => {
    if (loadingRef.current) return
    setIsBookmarked(initialBookmarked)
    setCount(initialCount)
    snapshotRef.current = initialCount
  }, [initialBookmarked, initialCount])

  const apiPath = entityType === 'mcp' ? 'mcp' : 'skills';

  // Fetch initial state on mount if authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    async function fetchBookmarkStatus() {
      try {
        const response = await fetch(`/api/${apiPath}/${entityId}/bookmark`);
        if (response.ok) {
          const data = await response.json();
          setIsBookmarked(data.isBookmarked);
        }
      } catch (error) {
        console.error('Failed to fetch bookmark status:', error);
      }
    }

    fetchBookmarkStatus();
  }, [apiPath, entityId, isAuthenticated]);

  async function handleToggle() {
    if (!isAuthenticated || loadingRef.current) {
      return;
    }

    loadingRef.current = true

    // Optimistic update
    const wasBookmarked = isBookmarked;
    setIsBookmarked(!isBookmarked);
    setCount((prev) => (isBookmarked ? prev - 1 : prev + 1));
    setIsLoading(true);

    try {
      const response = await fetch(`/api/${apiPath}/${entityId}/bookmark`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setIsBookmarked(data.isBookmarked);
        setCount(data.count);
        snapshotRef.current = data.count;
      } else {
        // Revert to last known server value
        setIsBookmarked(wasBookmarked);
        setCount(snapshotRef.current);
      }
    } catch (error) {
      // Revert to last known server value
      setIsBookmarked(wasBookmarked);
      setCount(snapshotRef.current);
      console.error('Failed to toggle bookmark:', error);
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      disabled={isLoading || !isAuthenticated}
      className={cn('gap-2', className)}
      title={isAuthenticated ? (isBookmarked ? t('social.removeFromBookmarks') : t('social.addToBookmarks')) : t('social.signInToBookmark')}
    >
      <motion.div
        initial={false}
        animate={isBookmarked ? { scale: prefersReducedMotion ? 1 : [1, 1.3, 1] } : { scale: 1 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: 'easeOut' }}
      >
        <Bookmark
          className={cn(
            'h-5 w-5 transition-colors',
            isBookmarked
              ? 'fill-primary text-primary'
              : 'text-muted-foreground hover:text-primary'
          )}
        />
      </motion.div>
      <span className="text-sm text-muted-foreground">{count}</span>
    </Button>
  );
}

BookmarkButton.displayName = 'BookmarkButton';
