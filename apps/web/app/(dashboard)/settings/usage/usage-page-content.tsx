"use client";

import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { UsageSection } from "../assistant/usage-section";
import { AssistantUsageCard } from "@/components/assistant/assistant-usage-card";
import { useSession } from "@/hooks/assistant/use-session";
import { useUsageSummary } from "@/hooks/assistant/use-usage-summary";
import { AnalyticsOverview } from "@/components/analytics/analytics-overview";
import { AnalyticsCharts } from "@/components/analytics/analytics-charts";
import { TopPackages } from "@/components/analytics/top-packages";

interface AnalyticsData {
  totalPackages: number;
  totalDownloads: number;
  totalFavorites: number;
  downloadsOverTime: Array<{ date: string; count: number }>;
  topMcps: Array<{ id: string; name: string; downloadsCount: number; bookmarksCount: number }>;
  topSkills: Array<{ id: string; name: string; downloadsCount: number; bookmarksCount: number }>;
}

export function UsagePageContent({ analyticsData }: { analyticsData: AnalyticsData }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useSession();
  const { windows, loading } = useUsageSummary();
  const plan = session?.user?.plan ?? "free";

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("settings.usage.title")}</h1>
      </div>

      <AssistantUsageCard
        plan={plan}
        windows={windows}
        loading={loading}
        onShowPlans={() => router.push("/settings/subscription")}
      />

      <UsageSection />

      <div className="border-t border-border/50" />

      <AnalyticsOverview
        totalPackages={analyticsData.totalPackages}
        totalDownloads={analyticsData.totalDownloads}
        totalFavorites={analyticsData.totalFavorites}
      />

      <AnalyticsCharts data={analyticsData.downloadsOverTime} />

      <TopPackages mcps={analyticsData.topMcps} skills={analyticsData.topSkills} />
    </div>
  );
}
