import dynamic from 'next/dynamic';
import { AdminPageSkeleton } from '@/components/admin/admin-page-skeleton';

const FeedbackManagement = dynamic(
  () => import('@/components/admin/feedbacks').then(m => ({ default: m.FeedbackManagement })),
  { loading: () => <AdminPageSkeleton /> }
);

export const metadata = { title: '反馈管理' };
export default function Page() { return <FeedbackManagement />; }
