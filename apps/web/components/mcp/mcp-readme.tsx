'use client';

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MarkdownContent } from '@/components/shared/markdown-content';

interface McpReadmeProps {
  content: string | null;
}

export function McpReadme({ content }: McpReadmeProps) {
  const { t } = useTranslation();

  if (!content) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('marketplace.readme')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{t('marketplace.noDocumentation')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('marketplace.readme')}</CardTitle>
      </CardHeader>
      <CardContent>
        <MarkdownContent content={content} />
      </CardContent>
    </Card>
  );
}
