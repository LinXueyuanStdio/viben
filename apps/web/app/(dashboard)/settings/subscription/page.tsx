"use client";

import { useTranslation } from "react-i18next";

export default function SubscriptionPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("settings.subscription.title")}</h1>
      <p className="text-muted-foreground">
        {t("settings.subscription.comingSoon")}
      </p>
    </div>
  );
}
