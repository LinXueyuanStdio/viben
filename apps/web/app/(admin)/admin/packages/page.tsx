import { PackageFilters, PackageTabs } from '@/components/admin/packages';

export const metadata = {
  title: '包审核',
};

interface PackagesPageProps {
  searchParams: Promise<{
    status?: string;
    type?: string;
    page?: string;
    sort?: string;
  }>;
}

export default async function PackagesPage({ searchParams }: PackagesPageProps) {
  const params = await searchParams;
  const currentType = params.type || 'all';
  const currentStatus = params.status || 'pending';
  const currentSort = params.sort || 'oldest';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">包审核</h1>
          <p className="text-muted-foreground">
            审核提交的包
          </p>
        </div>
        <PackageFilters status={currentStatus} sort={currentSort} />
      </div>

      {/* Tabs with URL sync */}
      <PackageTabs defaultType={currentType} status={currentStatus} />
    </div>
  );
}
