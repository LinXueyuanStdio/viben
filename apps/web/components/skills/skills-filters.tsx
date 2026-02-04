'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SKILL_CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'automation', label: 'Automation' },
  { value: 'coding', label: 'Coding' },
  { value: 'data', label: 'Data Processing' },
  { value: 'communication', label: 'Communication' },
  { value: 'research', label: 'Research' },
  { value: 'productivity', label: 'Productivity' },
  { value: 'other', label: 'Other' },
];

const SKILL_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'command', label: 'Command' },
  { value: 'prompt', label: 'Prompt' },
  { value: 'agent', label: 'Agent' },
];

const SORT_OPTIONS = [
  { value: 'latest', label: 'Latest' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'downloads', label: 'Most Downloads' },
];

interface SkillsFiltersProps {
  category?: string;
  type?: string;
  sort?: string;
}

export function SkillsFilters({ category, type, sort }: SkillsFiltersProps) {
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
          <SelectValue placeholder="Type" />
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
