'use client';

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MarkdownContent } from '@/components/shared/markdown-content';

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
        <MarkdownContent content={content} />
      </CardContent>
    </Card>
  );
}
