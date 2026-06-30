import dynamic from 'next/dynamic';
import { AdminPageSkeleton } from '@/components/admin/admin-page-skeleton';

const RatingManagement = dynamic(
  () => import('@/components/admin/ratings').then(m => ({ default: m.RatingManagement })),
  { loading: () => <AdminPageSkeleton /> }
);

export const metadata = { title: '评分管理' };
export default function Page() { return <RatingManagement />; }
