import { SettingsPageHeader } from "@/components/profile/settings-page-header";
import { ModelVariantsSection } from "./model-variants-section";
import { ModelPreferencesSection } from "./preferences-section";
import { SkillsSection } from "./skills-section";

export default function AssistantSettingsPage() {
  return (
    <div className="space-y-8">
      <SettingsPageHeader
        titleKey="settings.assistant.title"
        descriptionKey="settings.assistant.description"
        titleFallback="助手设置"
        descriptionFallback="配置默认模型、自定义模型变体和技能偏好。"
      />

      <ModelPreferencesSection />

      <div className="border-t border-border/50" />

      <ModelVariantsSection />

      <div className="border-t border-border/50" />

      <SkillsSection />
    </div>
  );
}
