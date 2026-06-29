"use client"

import { useTranslation } from "react-i18next"

/**
 * Client component that renders translated text.
 * Use in server components to replace hardcoded strings with i18n keys.
 *
 * @example
 * <T tKey="community.more" fallback="更多" />
 */
export function T({ tKey, fallback }: { tKey: string; fallback: string }) {
  const { t } = useTranslation()
  return <>{t(tKey, fallback)}</>
}

/**
 * Client wrapper for empty state messages.
 * Renders a centered muted paragraph with translated text.
 *
 * @example
 * <EmptyState tKey="community.noMoments" fallback="暂无动态" />
 */
export function EmptyState({
  tKey,
  fallback,
  className,
}: {
  tKey: string
  fallback: string
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <p className={`py-8 text-center text-sm text-muted-foreground${className ? ` ${className}` : ""}`}>
      {t(tKey, fallback)}
    </p>
  )
}
