'use client';

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type EntityType = 'mcp' | 'skill';

interface FavoriteButtonProps {
  entityType: EntityType;
  entityId: string;
  initialFavorited?: boolean;
  initialCount?: number;
  isAuthenticated?: boolean;
  className?: string;
}

export function FavoriteButton({
  entityType,
  entityId,
  initialFavorited = false,
  initialCount = 0,
  isAuthenticated = false,
  className,
}: FavoriteButtonProps) {
  const { t } = useTranslation();
  const [isFavorited, setIsFavorited] = React.useState(initialFavorited);
  const [count, setCount] = React.useState(initialCount);
  const [isLoading, setIsLoading] = React.useState(false);
  const prefersReducedMotion = useReducedMotion();

  const apiPath = entityType === 'mcp' ? 'mcp' : 'skills';

  // Fetch initial state on mount if authenticated
  React.useEffect(() => {
    if (!isAuthenticated) return;

    async function fetchFavoriteStatus() {
      try {
        const response = await fetch(`/api/${apiPath}/${entityId}/favorite`);
        if (response.ok) {
          const data = await response.json();
          setIsFavorited(data.isFavorited);
        }
      } catch (error) {
        console.error('Failed to fetch favorite status:', error);
      }
    }

    fetchFavoriteStatus();
  }, [apiPath, entityId, isAuthenticated]);

  async function handleToggle() {
    if (!isAuthenticated) {
      return;
    }

    // Optimistic update
    const wasAFavorite = isFavorited;
    setIsFavorited(!isFavorited);
    setCount((prev) => (isFavorited ? prev - 1 : prev + 1));
    setIsLoading(true);

    try {
      const response = await fetch(`/api/${apiPath}/${entityId}/favorite`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setIsFavorited(data.isFavorited);
        setCount(data.count);
      } else {
        // Revert on error
        setIsFavorited(wasAFavorite);
        setCount((prev) => (wasAFavorite ? prev + 1 : prev - 1));
      }
    } catch (error) {
      // Revert on error
      setIsFavorited(wasAFavorite);
      setCount((prev) => (wasAFavorite ? prev + 1 : prev - 1));
      console.error('Failed to toggle favorite:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      disabled={isLoading || !isAuthenticated}
      className={cn('gap-2', className)}
      title={isAuthenticated ? (isFavorited ? t('social.removeFromFavorites') : t('social.addToFavorites')) : t('social.signInToFavorite')}
    >
      <motion.div
        initial={false}
        animate={isFavorited ? { scale: prefersReducedMotion ? 1 : [1, 1.3, 1] } : { scale: 1 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: 'easeOut' }}
      >
        <Heart
          className={cn(
            'h-5 w-5 transition-colors',
            isFavorited
              ? 'fill-primary text-primary'
              : 'text-muted-foreground hover:text-primary'
          )}
        />
      </motion.div>
      <span className="text-sm text-muted-foreground">{count}</span>
    </Button>
  );
}

FavoriteButton.displayName = 'FavoriteButton';
