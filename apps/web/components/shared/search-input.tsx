'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Search, Loader2 } from 'lucide-react';

interface SearchInputProps {
  placeholder?: string;
  defaultValue?: string;
}

export function SearchInput({
  placeholder = 'Search...',
  defaultValue = '',
}: SearchInputProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(defaultValue);

  function handleSearch(newValue: string) {
    setValue(newValue);
    const params = new URLSearchParams(searchParams.toString());

    if (newValue) {
      params.set('q', newValue);
    } else {
      params.delete('q');
    }
    params.delete('page'); // Reset pagination on search

    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  }

  return (
    <div className="relative w-full max-w-sm">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleSearch(e.target.value)}
        className="pl-10 pr-10"
      />
      {isPending && (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
