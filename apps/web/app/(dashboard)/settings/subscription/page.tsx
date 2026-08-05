"use client";

import { useTranslation } from "react-i18next";
import useSWR from "swr";
import { Check, Sparkles, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { formatTokens } from "@viben/shared";
import { fetcher } from "@/lib/swr";
import { cn } from "@/lib/utils";

interface UsageResponse {
  usage: Array<{
    inputTokens: number;
    outputTokens: number;
  }>;
}

const MONTHLY_TOKEN_LIMIT = 1_000_000;

const FREE_FEATURES = [
  "subscription.features.publicPages",
  "subscription.features.basicThemes",
  "subscription.features.communityAccess",
  "subscription.features.aiAssistant",
  "subscription.features.githubIntegration",
  "subscription.features.analytics",
];

const PRO_FEATURES = [
  ...FREE_FEATURES,
  "subscription.features.customDomain",
  "subscription.features.prioritySupport",
  "subscription.features.higherLimits",
  "subscription.features.advancedAnalytics",
  "subscription.features.teamCollaboration",
  "subscription.features.apiAccess",
];

function PlanCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}

export default function SubscriptionPage() {
  const { t } = useTranslation();
  const { data: usageData, isLoading: usageLoading } = useSWR<UsageResponse>(
    "/api/usage",
    fetcher,
  );

  const totalTokens = usageData?.usage?.reduce(
    (sum, row) => sum + row.inputTokens + row.outputTokens,
    0,
  ) ?? 0;

  const usagePercent = Math.min(100, Math.round((totalTokens / MONTHLY_TOKEN_LIMIT) * 100));

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("settings.subscription.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("settings.subscription.description")}
        </p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                Free
                <Badge variant="secondary" className="text-xs">
                  {t("settings.subscription.currentPlan")}
                </Badge>
              </CardTitle>
              <CardDescription>
                {t("settings.subscription.freeDescription")}
              </CardDescription>
            </div>
            <Sparkles className="size-8 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Usage bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {t("settings.subscription.monthlyUsage")}
              </span>
              {usageLoading ? (
                <Skeleton className="h-4 w-20" />
              ) : (
                <span className="font-mono tabular-nums">
                  {formatTokens(totalTokens)} / {formatTokens(MONTHLY_TOKEN_LIMIT)}
                </span>
              )}
            </div>
            {usageLoading ? (
              <Skeleton className="h-2 w-full" />
            ) : (
              <Progress value={usagePercent} className="h-2" />
            )}
            <p className="text-xs text-muted-foreground">
              {t("settings.subscription.usageHint")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Free */}
        <Card className={cn("relative")}>
          <CardHeader>
            <CardTitle>Free</CardTitle>
            <CardDescription>
              {t("settings.subscription.freePrice")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {FREE_FEATURES.map((key) => (
                <li key={key} className="flex items-start gap-2 text-sm">
                  <Check className="size-4 shrink-0 text-green-500 mt-0.5" />
                  <span>{t(key)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Pro */}
        <Card className={cn("relative border-primary/50")}>
          <div className="absolute -top-3 left-4">
            <Badge>{t("settings.subscription.comingSoon")}</Badge>
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Pro
              <Zap className="size-4 text-primary" />
            </CardTitle>
            <CardDescription>
              {t("settings.subscription.proPrice")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {PRO_FEATURES.map((key) => (
                <li key={key} className="flex items-start gap-2 text-sm">
                  <Check className={cn(
                    "size-4 shrink-0 mt-0.5",
                    FREE_FEATURES.includes(key) ? "text-green-500" : "text-muted-foreground",
                  )} />
                  <span className={FREE_FEATURES.includes(key) ? "" : "text-muted-foreground"}>
                    {t(key)}
                  </span>
                </li>
              ))}
            </ul>
            <Button className="mt-6 w-full" disabled>
              {t("settings.subscription.upgradeToPro")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
