/**
 * Settings Skills Page - Embeds Skills Market within settings
 *
 * 设置页面中的技能管理，嵌入技能市场页面
 * Settings > Skills section embeds the SkillsMarketPage
 */
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

// Lazy load skills market page
const SkillsMarketPage = lazy(() =>
  import("@/pages/skills-market").then((m) => ({ default: m.SkillsMarketPage }))
);

function PageLoadingFallback() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">{t("common.loading")}</p>
      </div>
    </div>
  );
}

export function SettingsSkillsPage() {
  return (
    <div className="h-full overflow-auto">
      <Suspense fallback={<PageLoadingFallback />}>
        <SkillsMarketPage />
      </Suspense>
    </div>
  );
}
