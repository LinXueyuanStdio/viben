import { UserManagement } from '@/components/admin/users/user-management';

export const metadata = {
  title: 'User Management',
};

interface UsersPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    role?: string;
    sort?: string;
  }>;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const params = await searchParams;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-serif text-2xl font-bold">User Management</h1>
        <p className="text-muted-foreground">
          Manage user accounts and roles
        </p>
      </div>

      {/* User Management Component */}
      <UserManagement
        initialSearch={params.search}
        initialRole={params.role}
        initialSort={params.sort}
      />
    </div>
  );
}
