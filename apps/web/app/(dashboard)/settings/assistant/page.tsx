import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "助手设置",
};

export default function AssistantSettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">助手设置</h1>
      <p className="text-muted-foreground">
        模型选择、偏好设置、GitHub 连接管理等功能即将上线。
      </p>
    </div>
  );
}
