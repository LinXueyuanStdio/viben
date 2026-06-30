import dynamic from 'next/dynamic';
import { AdminPageSkeleton } from '@/components/admin/admin-page-skeleton';

const PageReviewManagement = dynamic(
  () => import('@/components/admin/pages').then(m => ({ default: m.PageReviewManagement })),
  { loading: () => <AdminPageSkeleton /> }
);

export const metadata = { title: '页面审核' };
export default function Page() { return <PageReviewManagement />; }
