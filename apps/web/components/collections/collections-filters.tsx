'use client';

import { useRouter, useSearchParams } from 'next/navigation';
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
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Most Popular</SelectItem>
          <SelectItem value="recent">Recently Added</SelectItem>
          <SelectItem value="items">Most Items</SelectItem>
          <SelectItem value="forks">Most Forked</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
