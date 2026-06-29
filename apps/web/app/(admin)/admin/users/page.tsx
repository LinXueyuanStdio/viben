import { UserManagement } from '@/components/admin/users/user-management';

export const metadata = {
  title: '用户管理',
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
        <h1 className="font-serif text-2xl font-bold">用户管理</h1>
        <p className="text-muted-foreground">
          管理用户账号和角色
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
