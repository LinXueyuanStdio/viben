"use client";

import { useTranslation } from "react-i18next";

interface SettingsPageHeaderProps {
  /** i18n key for title */
  titleKey: string;
  /** i18n key for description */
  descriptionKey: string;
  /** fallback text shown while i18n is loading */
  titleFallback: string;
  descriptionFallback: string;
}

/** 设置页标题的客户端包装器 — 唯一的作用是承载 useTranslation()，
 *  让父级 page.tsx 可以保持为 Server Component */
export function SettingsPageHeader({
  titleKey,
  descriptionKey,
  titleFallback,
  descriptionFallback,
}: SettingsPageHeaderProps) {
  const { t, ready } = useTranslation();

  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold">
        {ready ? t(titleKey) : titleFallback}
      </h1>
      <p className="text-sm text-muted-foreground">
        {ready ? t(descriptionKey) : descriptionFallback}
      </p>
    </div>
  );
}
