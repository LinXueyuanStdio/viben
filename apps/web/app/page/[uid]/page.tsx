import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, publishedPages } from '@/lib/db';

interface PublishedPageProps {
  params: Promise<{
    uid: string;
  }>;
}

const iframeSandbox = 'allow-scripts allow-forms allow-popups allow-modals allow-downloads';

export default async function PublishedPage({ params }: PublishedPageProps) {
  const { uid } = await params;
  const page = await db.query.publishedPages.findFirst({
    where: eq(publishedPages.uid, uid),
  });

  if (!page) {
    notFound();
  }

  return (
    <main className="fixed inset-0 bg-background">
      <iframe
        title={page.title}
        srcDoc={page.html}
        sandbox={iframeSandbox}
        className="h-full w-full border-0"
      />
    </main>
  );
}
