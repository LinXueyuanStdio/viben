'use client';

import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { Store, Package } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';

interface McpPageHeaderProps {
  userSlug?: string;
}

export function McpPageHeader({ userSlug }: McpPageHeaderProps) {
  const { t } = useTranslation();

  return (
    <PageHeader
      icon={Store}
      title={t('marketplace.title')}
      subtitle={t('marketplace.subtitle')}
    >
      {userSlug && (
        <Button variant="default" asChild>
          <Link href={`/${userSlug}?tab=mcp`}>
            <Package className="mr-2 h-4 w-4" />
            {t('marketplace.myMcp')}
          </Link>
        </Button>
      )}
    </PageHeader>
  );
}
