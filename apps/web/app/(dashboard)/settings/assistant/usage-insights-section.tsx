"use client";

import { useTranslation } from "react-i18next";
import { formatTokens } from "@viben/shared";
import type { UsageInsights } from "@/lib/usage/types";

interface UsageInsightsSectionProps {
  insights: UsageInsights;
}

function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function formatDecimal(value: number): string {
  return value.toFixed(1);
}

function formatLookbackLabel(lookbackDays: number, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (lookbackDays <= 1) return t("settings.usage.insights.day", { defaultValue: "1 day" });
  if (lookbackDays < 14) return t("settings.usage.insights.days", { count: lookbackDays, defaultValue: `${lookbackDays} days` });
  const lookbackWeeks = Math.round(lookbackDays / 7);
  return t("settings.usage.insights.weeks", { count: lookbackWeeks, defaultValue: `${lookbackWeeks} weeks` });
}

export function UsageInsightsSection({ insights }: UsageInsightsSectionProps) {
  const { t } = useTranslation();
  const lookbackLabel = formatLookbackLabel(insights.lookbackDays, t);
  const prDetail = t("settings.usage.insights.mergedPrCount", { merged: insights.pr.mergedPrCount, open: insights.pr.openPrCount, defaultValue: `${insights.pr.mergedPrCount} merged · ${insights.pr.openPrCount} open` });

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground">
          {t("settings.usage.insights.insights", { lookback: lookbackLabel })}
        </h2>
      </div>

      {/* Metrics grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label={t("settings.usage.insights.trackedPrs")}
          value={insights.pr.trackedPrCount.toLocaleString()}
          detail={prDetail}
        />
        <MetricCard
          label={t("settings.usage.insights.mergeRate")}
          value={formatPercent(insights.pr.mergeRate)}
          detail={t("settings.usage.insights.sessionsWithPrs", { count: insights.pr.sessionsWithPrCount, defaultValue: `${insights.pr.sessionsWithPrCount.toLocaleString()} sessions with PRs` })}
        />
        <MetricCard
          label={t("settings.usage.insights.largestTurn")}
          value={`${formatTokens(insights.efficiency.largestMainTurnTokens)}`}
          detail={t("settings.usage.insights.tokensMainAgent")}
        />
        <MetricCard
          label={t("settings.usage.insights.avgTokensPerTurn")}
          value={formatTokens(insights.efficiency.averageTokensPerMainTurn)}
          detail={t("settings.usage.insights.assistantTurns", { count: insights.efficiency.mainAssistantTurnCount, defaultValue: `${insights.efficiency.mainAssistantTurnCount.toLocaleString()} assistant turns` })}
        />
        <MetricCard
          label={t("settings.usage.insights.toolCallsPerTurn")}
          value={formatDecimal(insights.efficiency.toolCallsPerMainTurn)}
          detail={t("settings.usage.insights.acrossAllToolCalls")}
        />
        <MetricCard
          label={t("settings.usage.insights.cacheHitRatio")}
          value={formatPercent(insights.efficiency.cacheReadRatio)}
          detail={t("settings.usage.insights.cachedToTotal")}
        />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/10 px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-xl font-semibold tabular-nums leading-tight">
        {value}
      </div>
      {detail ? (
        <div className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground/70">
          {detail}
        </div>
      ) : null}
    </div>
  );
}
