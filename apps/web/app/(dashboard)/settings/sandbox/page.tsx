import type { Metadata } from "next";
import { SandboxSection } from "./sandbox-section";

export const metadata: Metadata = {
  title: "Sandbox",
  description: "配置 Sandbox 偏好设置。",
};

export default function SandboxPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Sandbox 设置</h1>
      <SandboxSection />
    </div>
  );
}
