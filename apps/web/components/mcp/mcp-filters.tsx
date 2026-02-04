'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const MCP_CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'database', label: 'Database' },
  { value: 'api', label: 'API Integration' },
  { value: 'file-system', label: 'File System' },
  { value: 'browser', label: 'Browser Automation' },
  { value: 'ai', label: 'AI/ML' },
  { value: 'productivity', label: 'Productivity' },
  { value: 'other', label: 'Other' },
];

const SORT_OPTIONS = [
  { value: 'latest', label: 'Latest' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'downloads', label: 'Most Downloads' },
];

interface McpFiltersProps {
  category?: string;
  sort?: string;
}

export function McpFilters({ category, sort }: McpFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

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
          <SelectValue placeholder="Category" />
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
          <SelectValue placeholder="Sort by" />
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
