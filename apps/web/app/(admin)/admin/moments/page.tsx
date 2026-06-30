import dynamic from 'next/dynamic';
import { AdminPageSkeleton } from '@/components/admin/admin-page-skeleton';

const MomentManagement = dynamic(
  () => import('@/components/admin/moments').then(m => ({ default: m.MomentManagement })),
  { loading: () => <AdminPageSkeleton /> }
);

export const metadata = { title: '动态管理' };
export default function Page() { return <MomentManagement />; }
