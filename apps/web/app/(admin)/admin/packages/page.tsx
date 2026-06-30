import dynamic from 'next/dynamic';
import { AdminPageSkeleton } from '@/components/admin/admin-page-skeleton';

const PackageReviewList = dynamic(
  () => import('@/components/admin/packages/package-review-list').then(m => ({ default: m.PackageReviewList })),
  { loading: () => <AdminPageSkeleton /> }
);

export const metadata = { title: '包审核' };
export default function Page() { return <PackageReviewList type="all" />; }
