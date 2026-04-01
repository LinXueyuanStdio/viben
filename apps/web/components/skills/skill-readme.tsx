'use client';

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SkillReadmeProps {
  content: string | null;
}

export function SkillReadme({ content }: SkillReadmeProps) {
  const { t } = useTranslation();

  if (!content) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('skills.readme.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{t('skills.readme.noDocumentation')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('skills.readme.title')}</CardTitle>
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
