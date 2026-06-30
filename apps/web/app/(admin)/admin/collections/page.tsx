import dynamic from 'next/dynamic';
import { AdminPageSkeleton } from '@/components/admin/admin-page-skeleton';

const CollectionModeration = dynamic(
  () => import('@/components/admin/collections').then(m => ({ default: m.CollectionModeration })),
  { loading: () => <AdminPageSkeleton /> }
);

export const metadata = { title: '合集管理' };
export default function Page() { return <CollectionModeration />; }
