import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db, publishedPages } from '@/lib/db';

interface PublishedPageProps {
  params: Promise<{
    user_id: string;
    page_id: string;
  }>;
}

const iframeSandbox = 'allow-scripts allow-forms allow-popups allow-modals allow-downloads';

export default async function PublishedPage({ params }: PublishedPageProps) {
  const { user_id: userId, page_id: pageId } = await params;
  const page = await db.query.publishedPages.findFirst({
    where: and(
      eq(publishedPages.userId, userId),
      eq(publishedPages.uid, pageId)
    ),
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
