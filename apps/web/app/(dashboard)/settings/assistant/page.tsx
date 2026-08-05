import type { Metadata } from "next";
import { ModelVariantsSection } from "./model-variants-section";
import { ModelPreferencesSection } from "./preferences-section";
import { SkillsSection } from "./skills-section";

export const metadata: Metadata = {
  title: "助手设置",
  description: "管理模型和 Skills 设置。",
};

export default function AssistantSettingsPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">助手设置</h1>
        <p className="text-sm text-muted-foreground">
          设置默认模型、创建模型变体和管理全局 Skills。
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
