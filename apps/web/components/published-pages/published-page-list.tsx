import Link from 'next/link';

interface PublishedPageListItem {
  uid: string;
  title: string;
  description: string | null;
  html: string;
}

interface PublishedPageListProps {
  userId: string;
  pages: PublishedPageListItem[];
}

const iframeSandbox = 'allow-scripts allow-forms allow-popups allow-modals allow-downloads';

export function PublishedPageList({ userId, pages }: PublishedPageListProps) {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted-foreground">{userId}</p>
          <h1 className="text-3xl font-semibold tracking-normal">Published pages</h1>
        </header>

        {pages.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
            No published pages yet.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pages.map((page) => (
              <Link
                key={page.uid}
                href={`/page/${encodeURIComponent(userId)}/${encodeURIComponent(page.uid)}`}
                className="group flex min-h-[320px] flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground transition-colors duration-200 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <div className="aspect-[4/3] overflow-hidden border-b border-border bg-muted">
                  <iframe
                    title={`Preview: ${page.title}`}
                    srcDoc={page.html}
                    sandbox={iframeSandbox}
                    className="h-full w-full origin-top-left scale-[0.55] border-0 bg-background sm:h-[182%] sm:w-[182%]"
                    tabIndex={-1}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h2 className="line-clamp-2 text-base font-semibold leading-6 tracking-normal">
                    {page.title}
                  </h2>
                  {page.description ? (
                    <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                      {page.description}
                    </p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
