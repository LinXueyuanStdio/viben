import type { Metadata } from "next";
import { SessionsIndexShell } from "@/components/assistant/sessions-index-shell";

export const metadata: Metadata = {
  title: "助手",
  description: "AI 编码助手",
};

export default function AssistantPage() {
  return <SessionsIndexShell />;
}
