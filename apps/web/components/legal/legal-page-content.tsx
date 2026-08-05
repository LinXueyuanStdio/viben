'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft } from 'lucide-react';

interface LegalPageContentProps {
  content: string;
}

export function LegalPageContent({ content }: LegalPageContentProps) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link
        href="/register"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={16} />
        {t('legal.backToRegister')}
      </Link>

      <article className="prose prose-neutral dark:prose-invert max-w-none
        prose-headings:font-semibold prose-headings:tracking-tight
        prose-h1:text-3xl prose-h1:font-bold
        prose-h2:mt-10 prose-h2:border-b prose-h2:border-border prose-h2:pb-2 prose-h2:text-xl
        prose-h3:text-lg
        prose-p:leading-7 prose-p:text-foreground/85
        prose-li:text-foreground/85
        prose-a:text-primary prose-a:no-underline hover:prose-a:underline
        prose-strong:text-foreground
        prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm
        prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground
        prose-table:border prose-table:border-border
        prose-th:border prose-th:border-border prose-th:bg-muted prose-th:px-4 prose-th:py-2
        prose-td:border prose-td:border-border prose-td:px-4 prose-td:py-2
        prose-hr:border-border
      ">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </article>
    </div>
  );
}
