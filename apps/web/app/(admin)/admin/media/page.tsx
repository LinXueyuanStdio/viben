import dynamic from 'next/dynamic';
import { AdminPageSkeleton } from '@/components/admin/admin-page-skeleton';

const MediaManagement = dynamic(
  () => import('@/components/admin/media').then(m => ({ default: m.MediaManagement })),
  { loading: () => <AdminPageSkeleton /> }
);

export const metadata = { title: '媒体管理' };
export default function Page() { return <MediaManagement />; }
