import dynamic from 'next/dynamic';
import { AdminPageSkeleton } from '@/components/admin/admin-page-skeleton';

const RankingManagement = dynamic(
  () => import('@/components/admin/rankings').then(m => ({ default: m.RankingManagement })),
  { loading: () => <AdminPageSkeleton /> }
);

export const metadata = { title: '榜单管理' };
export default function Page() { return <RankingManagement />; }
