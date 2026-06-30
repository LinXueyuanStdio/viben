import dynamic from 'next/dynamic';
import { AdminPageSkeleton } from '@/components/admin/admin-page-skeleton';

const OperationManagement = dynamic(
  () => import('@/components/admin/operations').then(m => ({ default: m.OperationManagement })),
  { loading: () => <AdminPageSkeleton /> }
);

export const metadata = { title: '运营位管理' };
export default function Page() { return <OperationManagement />; }
