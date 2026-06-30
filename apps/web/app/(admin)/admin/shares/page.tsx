import dynamic from 'next/dynamic';
import { AdminPageSkeleton } from '@/components/admin/admin-page-skeleton';

const ShareManagement = dynamic(
  () => import('@/components/admin/shares').then(m => ({ default: m.ShareManagement })),
  { loading: () => <AdminPageSkeleton /> }
);

export const metadata = { title: '分享管理' };
export default function Page() { return <ShareManagement />; }
