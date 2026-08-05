"use client";

import { useTranslation } from "react-i18next";
import { SandboxSection } from "./sandbox-section";

export default function SandboxPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("settings.sandbox.title")}</h1>
      <SandboxSection />
    </div>
  );
}
