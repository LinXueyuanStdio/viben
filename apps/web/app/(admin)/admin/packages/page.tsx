import { PackageFilters, PackageTabs } from '@/components/admin/packages';

export const metadata = {
  title: 'Package Moderation',
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
          <h1 className="font-serif text-2xl font-bold">Package Moderation</h1>
          <p className="text-muted-foreground">
            Review and moderate submitted packages
          </p>
        </div>
        <PackageFilters status={currentStatus} sort={currentSort} />
      </div>

      {/* Tabs with URL sync */}
      <PackageTabs defaultType={currentType} status={currentStatus} />
    </div>
  );
}
