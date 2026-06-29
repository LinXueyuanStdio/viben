import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/cookies';
import { getCollection } from '@/lib/services/collections';
import { EditCollectionForm } from '@/components/collections/edit-collection-form';

export const dynamic = 'force-dynamic';

interface EditCollectionPageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: '编辑合集',
};

export default async function EditCollectionPage({
  params,
}: EditCollectionPageProps) {
  const { id } = await params;
  const session = await getSession();

  if (!session?.userId) {
    redirect('/login');
  }

  const collection = await getCollection(id, session.userId);

  if (!collection) {
    notFound();
  }

  // Only owner can edit
  if (collection.ownerId !== session.userId) {
    redirect(`/collections/${id}`);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">编辑合集</h1>
        <p className="mt-2 text-muted-foreground">
          更新您的合集信息
        </p>
      </div>

      <EditCollectionForm collection={collection} />
    </div>
  );
}
