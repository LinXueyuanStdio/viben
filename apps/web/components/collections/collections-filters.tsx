'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CollectionsFiltersProps {
  sort?: string;
}

export function CollectionsFilters({ sort }: CollectionsFiltersProps) {
  const { t } = useTranslation('collections');
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateFilter(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'default') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page');
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={sort || 'default'}
        onValueChange={(value) => updateFilter('sort', value)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder={t('sortBy')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">{t('sortMostPopular')}</SelectItem>
          <SelectItem value="recent">{t('sortRecentlyAdded')}</SelectItem>
          <SelectItem value="items">{t('sortMostItems')}</SelectItem>
          <SelectItem value="forks">{t('sortMostForked')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
