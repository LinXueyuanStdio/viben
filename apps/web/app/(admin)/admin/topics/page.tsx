import dynamic from 'next/dynamic';
import { AdminPageSkeleton } from '@/components/admin/admin-page-skeleton';

const TopicManagement = dynamic(
  () => import('@/components/admin/topics').then(m => ({ default: m.TopicManagement })),
  { loading: () => <AdminPageSkeleton /> }
);

export const metadata = { title: '话题管理' };
export default function Page() { return <TopicManagement />; }
