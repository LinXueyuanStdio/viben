import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth/cookies';
import { getCollection, listCollectionItems } from '@/lib/services/collections';
import { CollectionHeader } from '@/components/collections/collection-header';
import { CollectionItems } from '@/components/collections/collection-items';
import { makeOG, makeTwitter, APP_URL } from '@/lib/metadata';

interface CollectionDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: CollectionDetailPageProps) {
  const { id } = await params;
  const collection = await getCollection(id);

  if (!collection) {
    return { title: 'Collection Not Found' };
  }

  return {
    title: collection.name,
    description: collection.description || 'A curated collection',
    alternates: {
      canonical: `${APP_URL}/collections/${id}`,
    },
    openGraph: makeOG({
      title: collection.name,
      description: collection.description || 'A curated collection',
      url: `${APP_URL}/collections/${id}`,
      type: "website",
    }),
    twitter: makeTwitter({
      title: collection.name,
      description: collection.description || 'A curated collection',
    }),
  };
}

export default async function CollectionDetailPage({
  params,
}: CollectionDetailPageProps) {
  const { id } = await params;
  const session = await getSession();

  const collection = await getCollection(id, session?.userId);

  if (!collection) {
    notFound();
  }

  const items = await listCollectionItems(id, session?.userId);
  const isOwner = session?.userId === collection.ownerId;

  return (
    <div className="space-y-8">
      <CollectionHeader
        collection={collection}
        itemCount={items.length}
        isOwner={isOwner}
        isLoggedIn={!!session}
      />
      <CollectionItems
        collectionId={collection.id}
        items={items}
        isOwner={isOwner}
      />
    </div>
  );
}
