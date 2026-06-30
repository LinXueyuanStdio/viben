import dynamic from 'next/dynamic';
import { AdminPageSkeleton } from '@/components/admin/admin-page-skeleton';

const AnalyticsDashboard = dynamic(
  () => import('@/components/admin/analytics').then(m => ({ default: m.AnalyticsDashboard })),
  { loading: () => <AdminPageSkeleton /> }
);

export const metadata = { title: '内容分析' };
export default function Page() { return <AnalyticsDashboard />; }
