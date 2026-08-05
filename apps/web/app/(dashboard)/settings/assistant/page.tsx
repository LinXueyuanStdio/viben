"use client";

import { useTranslation } from "react-i18next";
import { ModelVariantsSection } from "./model-variants-section";
import { ModelPreferencesSection } from "./preferences-section";
import { SkillsSection } from "./skills-section";

export default function AssistantSettingsPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("settings.assistant.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("settings.assistant.description")}
        </p>
      </div>

      <ModelPreferencesSection />

      <div className="border-t border-border/50" />

      <ModelVariantsSection />

      <div className="border-t border-border/50" />

      <SkillsSection />
    </div>
  );
}
