import dynamic from 'next/dynamic';
import { AdminPageSkeleton } from '@/components/admin/admin-page-skeleton';

const ActivityFeed = dynamic(
  () => import('@/components/admin/activity').then(m => ({ default: m.ActivityFeed })),
  { loading: () => <AdminPageSkeleton /> }
);

export const metadata = { title: '活动流' };
export default function Page() { return <ActivityFeed />; }
