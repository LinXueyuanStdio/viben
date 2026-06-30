import dynamic from 'next/dynamic';
import { AdminPageSkeleton } from '@/components/admin/admin-page-skeleton';

const ApiKeyManagement = dynamic(
  () => import('@/components/admin/api-keys').then(m => ({ default: m.ApiKeyManagement })),
  { loading: () => <AdminPageSkeleton /> }
);

export const metadata = { title: 'API 密钥管理' };
export default function Page() { return <ApiKeyManagement />; }
