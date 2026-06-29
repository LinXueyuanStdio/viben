import { Suspense } from 'react';
import Link from 'next/link';
import { PackageFilters, PackageReviewList } from '@/components/admin/packages';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';

export const metadata = {
  title: '技能队列',
};

interface SkillsQueuePageProps {
  searchParams: Promise<{
    status?: string;
    page?: string;
    sort?: string;
  }>;
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default async function SkillsQueuePage({ searchParams }: SkillsQueuePageProps) {
  const params = await searchParams;
  const currentStatus = params.status || 'pending';
  const currentSort = params.sort || 'oldest';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/admin/packages">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="font-serif text-2xl font-bold">技能队列</h1>
          </div>
          <p className="text-muted-foreground ml-10">
            审核等待审核的技能
          </p>
        </div>
        <PackageFilters status={currentStatus} sort={currentSort} />
      </div>

      {/* Package List */}
      <Suspense fallback={<LoadingFallback />}>
        <PackageReviewList type="skill" status={currentStatus} />
      </Suspense>
    </div>
  );
}
