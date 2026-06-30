import dynamic from 'next/dynamic';
import { AdminPageSkeleton } from '@/components/admin/admin-page-skeleton';

const CategoryManagement = dynamic(
  () => import('@/components/admin/categories').then(m => ({ default: m.CategoryManagement })),
  { loading: () => <AdminPageSkeleton /> }
);

export const metadata = { title: '分类管理' };
export default function Page() { return <CategoryManagement />; }
