"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { BookOpen, Package, ScrollText, ArrowRight, ExternalLink, Languages } from "lucide-react";

type Lang = "zh" | "en";

const t = {
  zh: {
    title: "文档",
    subtitle: "查阅 Viben 平台的使用指南和 API 参考",
    userTitle: "用户文档",
    userDesc: "面向 Viben 用户的完整使用指南，涵盖页面创建、发布、管理和社区互动等核心功能。",
    apiTitle: "API 文档",
    apiDesc: "面向 C 端创作者的 REST API，基于 OpenAPI 规范。支持页面管理、用户操作等。",
    mcpTitle: "MCP 文档",
    mcpDesc: "Viben MCP 服务基于 Model Context Protocol，让 AI 助手直接搜索、读取、创建和更新页面。",
  },
  en: {
    title: "Docs",
    subtitle: "Browse Viben platform guides and API references",
    userTitle: "User Guide",
    userDesc: "Complete guide for Viben users, covering page creation, publishing, management, and community features.",
    apiTitle: "API Docs",
    apiDesc: "REST API for creators, based on OpenAPI spec. Supports page management, user operations, and more.",
    mcpTitle: "MCP Docs",
    mcpDesc: "Viben MCP service based on Model Context Protocol. Let AI assistants search, read, create, and update pages directly.",
  },
};

function useCurrentLang(): Lang {
  const { i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return "zh";
  return (i18n.language?.startsWith("en") ? "en" : "zh") as Lang;
}

function LangSwitch() {
  const { i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isEn = mounted && i18n.language?.startsWith("en");
  return (
    <button
      onClick={() => i18n.changeLanguage(isEn ? "zh-CN" : "en")}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Languages size={14} />
      {mounted ? (isEn ? "中文" : "English") : "中文"}
    </button>
  );
}

export default function DocsIndexPage() {
  const l = useCurrentLang();

  const cards = [
    {
      href: "https://linxueyuan.online/viben/",
      external: true,
      icon: BookOpen,
      title: t[l].userTitle,
      desc: t[l].userDesc,
    },
    {
      href: "/docs/api",
      icon: ScrollText,
      title: t[l].apiTitle,
      desc: t[l].apiDesc,
    },
    {
      href: "/docs/mcp",
      icon: Package,
      title: t[l].mcpTitle,
      desc: t[l].mcpDesc,
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <BookOpen size={20} className="text-primary" />
            </div>
            <h1 className="font-bold text-2xl text-foreground md:text-3xl">{t[l].title}</h1>
          </div>
          <LangSwitch />
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">{t[l].subtitle}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => {
          const Comp = card.external ? "a" : Link;
          return (
            <Comp
              key={card.href}
              href={card.href}
              {...(card.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="group flex flex-col gap-3 rounded-xl border bg-card p-5 transition-colors hover:border-primary/30 hover:bg-surface"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <card.icon size={18} className="text-primary" />
                </div>
                <h2 className="font-semibold text-foreground">{card.title}</h2>
                {card.external ? (
                  <ExternalLink size={14} className="ml-auto shrink-0 text-muted-foreground opacity-50 transition-opacity group-hover:opacity-100" />
                ) : (
                  <ArrowRight size={16} className="ml-auto shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{card.desc}</p>
            </Comp>
          );
        })}
      </div>
    </div>
  );
}
