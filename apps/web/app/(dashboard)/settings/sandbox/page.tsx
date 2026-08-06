import { SettingsPageHeader } from "@/components/profile/settings-page-header";
import { SandboxSection } from "./sandbox-section";

export default function SandboxPage() {
  return (
    <div className="space-y-6">
      <SettingsPageHeader
        titleKey="settings.sandbox.title"
        descriptionKey="settings.sandbox.description"
        titleFallback="沙盒设置"
        descriptionFallback="配置代码执行环境、自动提交和 PR 管理偏好。"
      />
      <SandboxSection />
    </div>
  );
}
