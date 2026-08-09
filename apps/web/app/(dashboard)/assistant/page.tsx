import type { Metadata } from "next";
import { SessionsIndexShell } from "@/components/assistant/sessions-index-shell";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  title: "助手",
  description: "AI 编码助手 — 多智能体协作工作台",
  alternates: {
    canonical: `${APP_URL}/assistant`,
  },
  openGraph: {
    title: "助手",
    description: "AI 编码助手 — 多智能体协作工作台",
    url: `${APP_URL}/assistant`,
    type: "website",
  },
};

export default function AssistantPage() {
  return <SessionsIndexShell />;
}
