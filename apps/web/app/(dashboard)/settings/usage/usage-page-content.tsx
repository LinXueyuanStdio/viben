"use client";

import { useTranslation } from "react-i18next";
import { UsageSection } from "../assistant/usage-section";
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

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("settings.usage.title")}</h1>
      </div>

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
