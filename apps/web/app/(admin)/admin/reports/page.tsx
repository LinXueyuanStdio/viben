import dynamic from 'next/dynamic';
import { AdminPageSkeleton } from '@/components/admin/admin-page-skeleton';

const ReportManagement = dynamic(
  () => import('@/components/admin/reports').then(m => ({ default: m.ReportManagement })),
  { loading: () => <AdminPageSkeleton /> }
);

export const metadata = { title: '举报管理' };
export default function Page() { return <ReportManagement />; }
