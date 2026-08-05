"use client";

import { useTranslation } from "react-i18next";
import { UsageSection } from "../assistant/usage-section";

export default function UsagePage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("settings.usage.title")}</h1>
      <UsageSection />
    </div>
  );
}
