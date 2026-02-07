'use client';

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
        <div className="prose prose-sm max-w-none dark:prose-invert">
          {/* In production, use a markdown renderer like react-markdown */}
          <pre className="whitespace-pre-wrap text-sm">{content}</pre>
        </div>
      </CardContent>
    </Card>
  );
}
