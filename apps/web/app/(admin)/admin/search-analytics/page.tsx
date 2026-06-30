import dynamic from 'next/dynamic';
import { AdminPageSkeleton } from '@/components/admin/admin-page-skeleton';

const SearchAnalytics = dynamic(
  () => import('@/components/admin/search-analytics').then(m => ({ default: m.SearchAnalytics })),
  { loading: () => <AdminPageSkeleton /> }
);

export const metadata = { title: '搜索分析' };
export default function Page() { return <SearchAnalytics />; }
