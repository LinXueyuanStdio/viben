'use client';

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { MarkdownContent } from '@/components/shared/markdown-content';
import { cn } from '@/lib/utils/index';

interface TocEntry {
  level: number;
  text: string;
  slug: string;
}

/**
 * Extract headings from markdown content for Table of Contents
 */
function extractToc(content: string): TocEntry[] {
  const headingRegex = /^(#{1,4})\s+(.+)$/gm;
  const entries: TocEntry[] = [];
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const slug = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    entries.push({ level, text, slug });
  }
  return entries;
}

interface ReadmeSectionProps {
  content: string | null;
}

export function ReadmeSection({ content }: ReadmeSectionProps) {
  const { t } = useTranslation();
  const [tocOpen, setTocOpen] = useState(false);

  const toc = useMemo(() => {
    if (!content) return [];
    return extractToc(content);
  }, [content]);

  if (content === null) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground text-sm">
          {t('marketplace.noDocumentation', 'No documentation available.')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table of Contents (collapsible) */}
      {toc.length > 0 && (
        <div className="rounded-lg border border-border bg-card/50">
          <button
            className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors rounded-t-lg"
            onClick={() => setTocOpen(!tocOpen)}
          >
            <span className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              {t('marketplace.tableOfContents', 'Table of Contents')}
            </span>
            {tocOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          {tocOpen && (
            <nav className="px-4 pb-3 pt-1 border-t border-border">
              <ul className="space-y-1">
                {toc.map((entry, index) => (
                  <li key={index}>
                    <a
                      href={`#${entry.slug}`}
                      className={cn(
                        'block text-sm py-1 text-muted-foreground hover:text-foreground transition-colors',
                        entry.level >= 2 && 'pl-4',
                        entry.level >= 3 && 'pl-8',
                        entry.level >= 4 && 'pl-12'
                      )}
                    >
                      {entry.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      )}

      {/* README Content - full width, no Card wrapper */}
      <section className="py-2">
        <MarkdownContent content={content} />
      </section>
    </div>
  );
}
