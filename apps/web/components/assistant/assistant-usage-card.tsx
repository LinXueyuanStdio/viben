"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { UsageWindowSummary, UsageWindows } from "@/lib/usage/window";

interface AssistantUsageCardProps {
  plan: "free" | "pro";
  windows: UsageWindows;
  loading?: boolean;
  onShowPlans?: () => void;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "0m";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

function WindowRow({
  window,
  label,
  t,
}: {
  window: UsageWindowSummary;
  label: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const resetsLabel =
    window.resetsAt !== null
      ? t("assistant.usage.resetsIn", {
          time: formatDuration(window.resetsAt - Date.now()),
        })
      : null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">
          {label} ({formatDuration(window.windowMs)})
        </span>
        {resetsLabel ? (
          <span className="shrink-0 text-xs text-muted-foreground">
            {resetsLabel}
          </span>
        ) : null}
      </div>
      <Progress value={window.percent} className="h-2" />
      <div className="text-xs text-muted-foreground">
        {window.percent}% {t("assistant.usage.used")}
      </div>
    </div>
  );
}

export function AssistantUsageCard({
  plan,
  windows,
  loading = false,
  onShowPlans,
}: AssistantUsageCardProps) {
  const { t } = useTranslation();
  const isPro = plan === "pro";
  const planLabel = isPro
    ? t("assistant.usage.pro")
    : t("assistant.usage.free");

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-12" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("assistant.usage.title")}</CardTitle>
        <CardDescription className="font-medium">{planLabel}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t("assistant.usage.description")}
        </p>

        <WindowRow
          window={windows.session}
          label={t("assistant.usage.thisSession")}
          t={t}
        />
        <WindowRow
          window={windows.week}
          label={t("assistant.usage.thisWeek")}
          t={t}
        />

        {!isPro ? (
          <div className="space-y-2 border-t border-border/50 pt-4">
            <p className="text-sm font-medium">{t("assistant.usage.needMore")}</p>
            <p className="text-sm text-muted-foreground">
              {t("assistant.usage.upgradePro")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onShowPlans}
            >
              {t("assistant.usage.showPlans")}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
