'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PackageReviewList } from './package-review-list';
import { Loader2 } from 'lucide-react';

interface PackageTabsProps {
  defaultType: string;
  status: string;
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export function PackageTabs({ defaultType, status }: PackageTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete('type');
    } else {
      params.set('type', value);
    }
    params.delete('page'); // Reset pagination on tab change
    router.push(`?${params.toString()}`);
  };

  return (
    <Tabs
      defaultValue={defaultType}
      value={defaultType}
      onValueChange={handleTabChange}
      className="space-y-4"
    >
      <TabsList>
        <TabsTrigger value="all">All Packages</TabsTrigger>
        <TabsTrigger value="mcp">MCP Packages</TabsTrigger>
        <TabsTrigger value="skill">Skills</TabsTrigger>
      </TabsList>

      <TabsContent value="all" className="mt-4">
        <Suspense fallback={<LoadingFallback />}>
          <PackageReviewList type="all" status={status} />
        </Suspense>
      </TabsContent>

      <TabsContent value="mcp" className="mt-4">
        <Suspense fallback={<LoadingFallback />}>
          <PackageReviewList type="mcp" status={status} />
        </Suspense>
      </TabsContent>

      <TabsContent value="skill" className="mt-4">
        <Suspense fallback={<LoadingFallback />}>
          <PackageReviewList type="skill" status={status} />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
