import dynamic from 'next/dynamic';
import { AdminPageSkeleton } from '@/components/admin/admin-page-skeleton';

const UserManagement = dynamic(
  () => import('@/components/admin/users').then(m => ({ default: m.UserManagement })),
  { loading: () => <AdminPageSkeleton /> }
);

export const metadata = { title: '用户管理' };
export default function Page() { return <UserManagement />; }
