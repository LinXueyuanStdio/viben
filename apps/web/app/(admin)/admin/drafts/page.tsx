import dynamic from 'next/dynamic';
import { AdminPageSkeleton } from '@/components/admin/admin-page-skeleton';

const DraftManagement = dynamic(
  () => import('@/components/admin/drafts').then(m => ({ default: m.DraftManagement })),
  { loading: () => <AdminPageSkeleton /> }
);

export const metadata = { title: '草稿管理' };
export default function Page() { return <DraftManagement />; }
