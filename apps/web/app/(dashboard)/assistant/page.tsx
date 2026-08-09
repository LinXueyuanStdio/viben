import type { Metadata } from "next";
import { SessionsIndexShell } from "@/components/assistant/sessions-index-shell";
import { makeOG, makeTwitter, APP_URL } from "@/lib/metadata";

export const metadata: Metadata = {
  title: "助手",
  description: "AI 编码助手 — 多智能体协作工作台",
  alternates: {
    canonical: `${APP_URL}/assistant`,
  },
  openGraph: makeOG({
    title: "助手",
    description: "AI 编码助手 — 多智能体协作工作台",
    url: `${APP_URL}/assistant`,
    type: "website",
  }),
  twitter: makeTwitter({
    title: "助手",
    description: "AI 编码助手 — 多智能体协作工作台",
  }),
};

export default function AssistantPage() {
  return <SessionsIndexShell />;
}
