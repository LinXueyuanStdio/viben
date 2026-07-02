'use client';

import { memo, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import { ChevronDown, ChevronUp, Copy, Check, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/index';
import type { Components } from 'react-markdown';
import type { AnchorHTMLAttributes, ImgHTMLAttributes, HTMLAttributes } from 'react';

interface MarkdownContentProps {
  content: string;
  /** max characters before collapsing, default 2000 */
  collapseThreshold?: number;
}

/**
 * Inline copy button for code blocks
 */
function CodeCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [text]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover/pre:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy code'}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

/**
 * Extract language from rehype-highlight class (e.g., "hljs language-typescript" -> "typescript")
 */
function extractLanguage(className?: string): string | null {
  if (!className) return null;
  const match = className.match(/language-(\w+)/);
  return match ? match[1] : null;
}

/**
 * Image lightbox component
 */
function ImageLightbox({ src, alt }: { src: string; alt?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt || ''}
        loading="lazy"
        className="max-w-full rounded-lg cursor-zoom-in hover:opacity-90 transition-opacity"
        onClick={() => setOpen(true)}
      />
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-8"
          onClick={() => setOpen(false)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20 z-50"
            onClick={() => setOpen(false)}
          >
            <X className="h-6 w-6" />
          </Button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt || ''}
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

/**
 * Recursively extract text content from React children
 */
function extractTextContent(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number' || typeof children === 'boolean') return String(children);
  if (Array.isArray(children)) {
    return children.map(extractTextContent).join('');
  }
  if (children && typeof children === 'object' && 'props' in children) {
    const props = (children as { props?: { children?: React.ReactNode } }).props;
    if (props?.children) {
      return extractTextContent(props.children);
    }
  }
  return '';
}

/**
 * Custom components for react-markdown.
 * - Opens external links in new tab with security attributes
 * - Handles broken images gracefully
 * - Adds copy button to code blocks
 * - Enhances tables with hover and striped rows
 * - Supports image lightbox
 */
function createMarkdownComponents(): Components {
  return {
    h1({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
      return (
        <h1
          className="text-2xl font-bold mt-8 mb-4 pb-2 border-b border-border"
          {...props}
        >
          {children}
        </h1>
      );
    },
    h2({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
      return (
        <h2
          className="text-xl font-semibold mt-6 mb-3"
          {...props}
        >
          {children}
        </h2>
      );
    },
    h3({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
      return (
        <h3
          className="text-lg font-semibold mt-5 mb-2"
          {...props}
        >
          {children}
        </h3>
      );
    },
    a({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
      const isExternal =
        href && (href.startsWith('http://') || href.startsWith('https://'));
      return (
        <a
          href={href}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:no-underline"
          {...props}
        >
          {children}
          {isExternal && (
            <ExternalLink className="inline h-3 w-3 shrink-0" />
          )}
        </a>
      );
    },
    img({ src, alt }: ImgHTMLAttributes<HTMLImageElement>) {
      if (!src || typeof src !== 'string') return null;
      return <ImageLightbox src={src} alt={alt} />;
    },
    table({ children, ...props }: HTMLAttributes<HTMLTableElement>) {
      return (
        <div className="overflow-x-auto rounded-lg border border-border my-4">
          <table className="w-full border-collapse" {...props}>
            {children}
          </table>
        </div>
      );
    },
    thead({ children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
      return (
        <thead className="bg-muted/50" {...props}>
          {children}
        </thead>
      );
    },
    th({ children, ...props }: HTMLAttributes<HTMLTableCellElement>) {
      return (
        <th className="border-b border-border px-4 py-2.5 text-left text-sm font-semibold" {...props}>
          {children}
        </th>
      );
    },
    td({ children, ...props }: HTMLAttributes<HTMLTableCellElement>) {
      return (
        <td className="border-b border-border/50 px-4 py-2 text-sm even:bg-muted/20" {...props}>
          {children}
        </td>
      );
    },
    tr({ children, ...props }: HTMLAttributes<HTMLTableRowElement>) {
      return (
        <tr className="hover:bg-muted/30 transition-colors" {...props}>
          {children}
        </tr>
      );
    },
    pre({ children, className, ...props }: HTMLAttributes<HTMLPreElement>) {
      const language = extractLanguage(className);
      // Extract text content from children for copy button
      const codeText = extractTextContent(children);

      return (
        <div className="relative group/pre my-4">
          {language && (
            <div className="absolute top-0 left-4 -translate-y-full rounded-t-md bg-muted px-3 py-1 text-xs font-mono text-muted-foreground border border-border border-b-0">
              {language}
            </div>
          )}
          <pre
            className={cn(
              'rounded-lg bg-muted p-4 overflow-x-auto text-sm border border-border',
              language && 'rounded-tl-none'
            )}
            {...props}
          >
            {children}
          </pre>
          {codeText && <CodeCopyButton text={codeText} />}
        </div>
      );
    },
    code({ children, className, ...props }: HTMLAttributes<HTMLElement> & { className?: string }) {
      // Inline code (not inside pre)
      const isInline = !className?.includes('hljs');
      if (isInline) {
        return (
          <code
            className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono"
            {...props}
          >
            {children}
          </code>
        );
      }
      return (
        <code className={cn('text-sm font-mono', className)} {...props}>
          {children}
        </code>
      );
    },
  } as Components;
}

export const MarkdownContent = memo(function MarkdownContent({
  content,
  collapseThreshold = 2000,
}: MarkdownContentProps) {
  const shouldCollapse = content.length > collapseThreshold;
  const [expanded, setExpanded] = useState(false);

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const markdownComponents = createMarkdownComponents();

  return (
    <div>
      {/* Collapsible content area with gradient overlay */}
      <div className="relative">
        <div
          className={cn(
            'text-sm leading-relaxed text-foreground max-w-none',
            '[&_p]:leading-7 [&_p]:my-3',
            '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-3',
            '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-3',
            '[&_li]:mt-1',
            '[&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:my-3',
            '[&_hr]:border-border [&_hr]:my-6',
            '[&_strong]:font-semibold',
            '[&_del]:line-through',
            shouldCollapse && !expanded && 'max-h-96 overflow-hidden'
          )}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight, rehypeSlug]}
            components={markdownComponents}
          >
            {content}
          </ReactMarkdown>
        </div>

        {/* Fade gradient when collapsed — positioned within this inner relative container */}
        {shouldCollapse && !expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        )}
      </div>

      {/* Toggle button — outside the gradient's relative container so it's never covered */}
      {shouldCollapse && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggle}
            className="gap-1.5"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Show full content
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
});
