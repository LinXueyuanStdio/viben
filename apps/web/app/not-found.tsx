'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { NotFoundIllustration } from '@/components/not-found-illustration';

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center text-center">
        {/* 插画 */}
        <NotFoundIllustration className="mb-2" />

        {/* 404 数字 */}
        <h1
          className="text-[10rem] font-bold leading-none tracking-tight"
          style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, color-mix(in oklch, var(--primary) 60%, var(--destructive)) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          404
        </h1>

        {/* 标题 */}
        <h2 className="mt-6 text-2xl font-semibold text-foreground">
          {t('notFoundPage.title')}
        </h2>

        {/* 描述 */}
        <p className="mt-3 max-w-md text-base text-muted-foreground">
          {t('notFoundPage.description')}
        </p>

        {/* 返回首页按钮 */}
        <Button asChild size="lg" className="mt-8">
          <Link href="/">{t('notFoundPage.backHome')}</Link>
        </Button>
      </div>
    </div>
  );
}
