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

interface SkillsFiltersProps {
  category?: string;
  type?: string;
  sort?: string;
}

export function SkillsFilters({ category, type, sort }: SkillsFiltersProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const SKILL_CATEGORIES = [
    { value: 'all', label: t('skills.filters.allCategories') },
    { value: 'automation', label: t('skills.filters.categories.automation') },
    { value: 'coding', label: t('skills.filters.categories.coding') },
    { value: 'data', label: t('skills.filters.categories.data') },
    { value: 'communication', label: t('skills.filters.categories.communication') },
    { value: 'research', label: t('skills.filters.categories.research') },
    { value: 'productivity', label: t('skills.filters.categories.productivity') },
    { value: 'other', label: t('skills.filters.categories.other') },
  ];

  const SKILL_TYPES = [
    { value: 'all', label: t('skills.filters.allTypes') },
    { value: 'command', label: t('skills.filters.types.command') },
    { value: 'prompt', label: t('skills.filters.types.prompt') },
    { value: 'agent', label: t('skills.filters.types.agent') },
  ];

  const SORT_OPTIONS = [
    { value: 'latest', label: t('skills.filters.sort.latest') },
    { value: 'popular', label: t('skills.filters.sort.popular') },
    { value: 'downloads', label: t('skills.filters.sort.downloads') },
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
          <SelectValue placeholder={t('skills.filters.categoryPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {SKILL_CATEGORIES.map((cat) => (
            <SelectItem key={cat.value} value={cat.value}>
              {cat.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={type || 'all'}
        onValueChange={(v) => updateFilter('type', v)}
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder={t('skills.filters.typePlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {SKILL_TYPES.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={sort || 'latest'}
        onValueChange={(v) => updateFilter('sort', v)}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder={t('skills.filters.sortPlaceholder')} />
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
