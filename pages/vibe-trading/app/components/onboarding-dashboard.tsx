"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AccountManagerDialog } from "./account-manager";

export function OnboardingDashboard() {
  const router = useRouter();
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-foreground">Trading Terminal</h1>
          <p className="mt-2 text-muted-foreground text-lg">AI 驱动的智能交易系统</p>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* Account Management Card */}
          <div
            onClick={() => setAccountDialogOpen(true)}
            className="rounded-xl border border-border p-6 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all bg-card group"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
              <svg
                className="w-5 h-5 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-foreground mb-1">账户管理</h3>
            <p className="text-sm text-muted-foreground">配置你的交易所 API Key</p>
          </div>

          {/* Strategy Settings Card */}
          <div
            onClick={() => alert("策略设置 - 开发中")}
            className="rounded-xl border border-border p-6 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all bg-card group"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
              <svg
                className="w-5 h-5 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-foreground mb-1">策略设置</h3>
            <p className="text-sm text-muted-foreground">设置风控和 AI 参数</p>
          </div>

          {/* Start Trading Card */}
          <div
            onClick={() => router.push("/?create=true")}
            className="rounded-xl border border-primary/20 bg-primary/5 p-6 cursor-pointer hover:shadow-md hover:border-primary/40 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center mb-4 group-hover:bg-primary/30 transition-colors">
              <svg
                className="w-5 h-5 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-foreground mb-1">开始交易</h3>
            <p className="text-sm text-muted-foreground">创建第一个会话</p>
          </div>
        </div>

        {/* Quick Start Guide */}
        <div className="rounded-xl border border-border bg-muted p-6">
          <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
            <svg
              className="w-4 h-4 text-warning"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            快速开始
          </h4>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center mt-0.5">
                1
              </span>
              <span>添加交易所 API Key（支持 Binance / OKX / Bitget / Bybit / Gate.io）</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center mt-0.5">
                2
              </span>
              <span>配置策略参数和风控规则</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center mt-0.5">
                3
              </span>
              <span>创建会话开始自动交易</span>
            </li>
          </ol>
        </div>
      </div>

      {/* Account Manager Dialog */}
      <AccountManagerDialog
        open={accountDialogOpen}
        onClose={() => setAccountDialogOpen(false)}
      />
    </div>
  );
}
