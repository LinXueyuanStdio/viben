import { Building2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Organizations',
};

export default function OrganizationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organizations</h1>
          <p className="text-muted-foreground">
            Manage your teams and shared packages.
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Organization
        </Button>
      </div>

      {/* Empty state */}
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
        <div className="rounded-full bg-muted p-4">
          <Building2 className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">No organizations yet</h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Create an organization to collaborate with your team and publish
          packages together.
        </p>
        <Button className="mt-4">
          <Plus className="mr-2 h-4 w-4" />
          Create Organization
        </Button>
      </div>
    </div>
  );
}
