'use client';

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface CommentFormProps {
  onSubmit: (content: string, parentId?: string) => Promise<void>;
  parentId?: string;
  replyingToUsername?: string;
  onCancelReply?: () => void;
  isAuthenticated: boolean;
  className?: string;
}

export function CommentForm({
  onSubmit,
  parentId,
  replyingToUsername,
  onCancelReply,
  isAuthenticated,
  className,
}: CommentFormProps) {
  const { t } = useTranslation();
  const [content, setContent] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Focus textarea when replying
  React.useEffect(() => {
    if (parentId && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [parentId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedContent = content.trim();
    if (!trimmedContent || !isAuthenticated) return;

    setIsSubmitting(true);
    try {
      await onSubmit(trimmedContent, parentId);
      setContent('');
      if (onCancelReply) {
        onCancelReply();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className={cn('rounded-lg border bg-muted/50 p-4 text-center', className)}>
        <p className="text-sm text-muted-foreground">
          {t('social.signInToComment')}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-3', className)}>
      {parentId && replyingToUsername && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{t('social.replyingTo', { username: replyingToUsername })}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={onCancelReply}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      <Textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={parentId ? t('social.writeReplyPlaceholder') : t('social.writeCommentPlaceholder')}
        className="min-h-[80px] resize-none"
        maxLength={2000}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {content.length}/2000
        </span>
        <Button
          type="submit"
          size="sm"
          disabled={!content.trim() || isSubmitting}
        >
          <Send className="mr-2 h-4 w-4" />
          {isSubmitting ? t('social.posting') : parentId ? t('social.reply') : t('social.comment')}
        </Button>
      </div>
    </form>
  );
}

CommentForm.displayName = 'CommentForm';
