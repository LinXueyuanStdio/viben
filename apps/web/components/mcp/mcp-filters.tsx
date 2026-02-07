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

interface McpFiltersProps {
  category?: string;
  sort?: string;
}

export function McpFilters({ category, sort }: McpFiltersProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const MCP_CATEGORIES = [
    { value: 'all', label: t('marketplace.allCategories') },
    { value: 'database', label: t('marketplace.categoryDatabase') },
    { value: 'api', label: t('marketplace.categoryApi') },
    { value: 'file-system', label: t('marketplace.categoryFileSystem') },
    { value: 'browser', label: t('marketplace.categoryBrowser') },
    { value: 'ai', label: t('marketplace.categoryAi') },
    { value: 'productivity', label: t('marketplace.categoryProductivity') },
    { value: 'other', label: t('marketplace.categoryOther') },
  ];

  const SORT_OPTIONS = [
    { value: 'latest', label: t('marketplace.sortLatest') },
    { value: 'popular', label: t('marketplace.sortPopular') },
    { value: 'downloads', label: t('marketplace.sortDownloads') },
  ];

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page'); // Reset pagination
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex gap-2">
      <Select
        value={category || 'all'}
        onValueChange={(v) => updateFilter('category', v)}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder={t('marketplace.category')} />
        </SelectTrigger>
        <SelectContent>
          {MCP_CATEGORIES.map((cat) => (
            <SelectItem key={cat.value} value={cat.value}>
              {cat.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={sort || 'latest'}
        onValueChange={(v) => updateFilter('sort', v)}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder={t('marketplace.sortBy')} />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
