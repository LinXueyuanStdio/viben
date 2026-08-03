'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { NotFoundIllustration } from '@/components/not-found-illustration';
import { VibenLogo } from '@/components/shared/viben-logo';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <DashboardShell>
      <div className="flex flex-1 flex-col items-center justify-center py-12">
        <div className="flex flex-col items-center text-center">
          {/* Logo */}
          <Link
            href="/"
            className="mb-8 flex items-center gap-2"
          >
            <VibenLogo size={28} />
            <span className="font-serif text-lg font-semibold text-foreground">
              Viben
            </span>
          </Link>

          {/* 插画 */}
          <NotFoundIllustration className="mb-2" />

          {/* 404 数字 */}
          <h1
            className="text-[9rem] font-bold leading-none tracking-tight"
            style={{
              background:
                'linear-gradient(135deg, var(--color-primary) 0%, color-mix(in oklch, var(--color-primary) 60%, var(--color-accent)) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            404
          </h1>

          {/* 标题 */}
          <h2 className="mt-4 text-xl font-semibold text-foreground">
            {t('notFoundPage.title')}
          </h2>

          {/* 描述 */}
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {t('notFoundPage.description')}
          </p>

          {/* 返回首页按钮 */}
          <div className="mt-8">
            <Button asChild size="lg">
              <Link href="/">{t('notFoundPage.backHome')}</Link>
            </Button>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
