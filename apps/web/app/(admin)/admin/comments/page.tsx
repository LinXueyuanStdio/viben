import dynamic from 'next/dynamic';
import { AdminPageSkeleton } from '@/components/admin/admin-page-skeleton';

const CommentModeration = dynamic(
  () => import('@/components/admin/comments').then(m => ({ default: m.CommentModeration })),
  { loading: () => <AdminPageSkeleton /> }
);

export const metadata = { title: '评论管理' };
export default function Page() { return <CommentModeration />; }
