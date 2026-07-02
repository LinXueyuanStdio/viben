'use client';

import { useQuery } from '@tanstack/react-query';

export function usePageData(
  userSlug: string,
  pageId: string,
  fields: 'meta' | 'html' | 'all' = 'meta',
) {
  return useQuery({
    queryKey: ['page-data', userSlug, pageId, fields],
    queryFn: async () => {
      const res = await fetch(
        `/api/read/${encodeURIComponent(userSlug)}/${encodeURIComponent(pageId)}?fields=${fields}`,
      );
      if (!res.ok) throw new Error('Page not found');
      return res.json();
    },
    staleTime: fields === 'meta' ? 120_000 : 300_000,
    gcTime: 10 * 60_000,
  });
}
