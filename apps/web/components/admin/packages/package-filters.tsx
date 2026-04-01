'use client';

import { useTranslation } from 'react-i18next';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PackageFiltersProps {
  status?: string;
  sort?: string;
}

export function PackageFilters({ status, sort }: PackageFiltersProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const STATUS_OPTIONS = [
    { value: 'pending', label: t('dashboard.admin.packages.status.pending') },
    { value: 'approved', label: t('dashboard.admin.packages.status.approved') },
    { value: 'rejected', label: t('dashboard.admin.packages.status.rejected') },
    { value: 'featured', label: t('dashboard.admin.packages.status.featured') },
  ];

  const SORT_OPTIONS = [
    { value: 'oldest', label: t('dashboard.admin.packages.sort.oldest') },
    { value: 'newest', label: t('dashboard.admin.packages.sort.newest') },
  ];

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page'); // Reset pagination on filter change
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex gap-2">
      <Select
        value={status || 'pending'}
        onValueChange={(v) => updateFilter('status', v)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder={t('dashboard.admin.packages.statusPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={sort || 'oldest'}
        onValueChange={(v) => updateFilter('sort', v)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder={t('dashboard.admin.packages.sortPlaceholder')} />
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
