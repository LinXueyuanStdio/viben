import dynamic from 'next/dynamic';
import { AdminPageSkeleton } from '@/components/admin/admin-page-skeleton';

const NotificationManagement = dynamic(
  () => import('@/components/admin/notifications').then(m => ({ default: m.NotificationManagement })),
  { loading: () => <AdminPageSkeleton /> }
);

export const metadata = { title: '通知管理' };
export default function Page() { return <NotificationManagement />; }
