import { notFound, redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
import { getSession } from '@/lib/auth/cookies';
import { getCollection } from '@/lib/services/collections';
import { EditCollectionForm } from '@/components/collections/edit-collection-form';

interface EditCollectionPageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: 'Edit Collection',
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
        <h1 className="text-3xl font-bold">Edit Collection</h1>
        <p className="mt-2 text-muted-foreground">
          Update your collection details
        </p>
      </div>

      <EditCollectionForm collection={collection} />
    </div>
  );
}
