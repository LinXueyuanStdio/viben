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
  type?: string;
}

export function CollectionsFilters({ type }: CollectionsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateFilter(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') {
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
        value={type || 'all'}
        onValueChange={(value) => updateFilter('type', value)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="mcp">MCP</SelectItem>
          <SelectItem value="skill">Skills</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
