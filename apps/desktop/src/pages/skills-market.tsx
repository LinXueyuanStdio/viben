import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  CommunitySkillGrid,
  OfficialSkillGrid,
  SearchBar,
  SkillDetail,
  SkillSourceTabs,
} from "@/components/skills";
import { useSkillInstall } from "@/hooks/use-skill-install";
import type {
  InstallableSkill,
  SkillDetailItem,
  SkillSource,
} from "@/components/skills";
import { useAnalytics } from "@/lib/analytics";
import { AnalyticsEvents } from "@/lib/analytics/types";

export function SkillsMarketPage() {
  const { t } = useTranslation();
  const { logEvent } = useAnalytics();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [source, setSource] = useState<SkillSource>("official");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<SkillDetailItem | null>(
    null
  );
  const [detailOpen, setDetailOpen] = useState(false);
  const { install, isInstalled, isInstalling, getProgress } = useSkillInstall();

  // Track skills_marketplace_opened
  useEffect(() => {
    try { logEvent(AnalyticsEvents.SKILLS_MARKETPLACE_OPENED, { source: "sidebar" }); } catch {}
  }, []);

  const handleSourceChange = useCallback((nextSource: SkillSource) => {
    setSource(nextSource);
    setSearchQuery("");
    setSelectedSkill(null);
    setDetailOpen(false);

    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, []);

  const handleViewDetails = useCallback((skill: SkillDetailItem) => {
    setSelectedSkill(skill);
    setDetailOpen(true);
    try {
      const data = skill.data;
      const skillId = "id" in data ? String(data.id || "") : "";
      const skillName = "name" in data ? String(data.name || "") : "";
      const triggerWords: string[] = "trigger_words" in data ? (Array.isArray(data.trigger_words) ? data.trigger_words : []) : [];
      const filesCount = "files" in data ? ((data.files as Record<string, unknown> | undefined) ? Object.keys(data.files as Record<string, unknown>).length : 0) : 0;
      logEvent(AnalyticsEvents.SKILL_DETAIL_VIEWED, {
        skill_id: skillId,
        skill_name: skillName,
        trigger_words: triggerWords,
        files_count: filesCount,
      });
    } catch {}
  }, [logEvent]);

  // Track search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (query) {
      try {
        logEvent(AnalyticsEvents.SKILLS_MARKETPLACE_SEARCHED, {
          search_query: query,
          results_count: 0,
        });
      } catch {}
    }
  }, [logEvent]);

  // Wrap install to add tracking
  const handleInstall = useCallback(async (skill: InstallableSkill) => {
    const data = skill.data;
    const skillId = "id" in data ? String(data.id || "") : "";
    const skillName = "name" in data ? String(data.name || "") : "";

    try {
      logEvent(AnalyticsEvents.SKILL_INSTALL_STARTED, {
        skill_id: skillId,
        skill_name: skillName,
        install_source: source,
      });
    } catch {}

    const startTime = Date.now();
    try {
      await install(skill);
      try {
        logEvent(AnalyticsEvents.SKILL_INSTALL_COMPLETED, {
          skill_id: skillId,
          skill_name: skillName,
          install_source: source,
          duration_ms: Date.now() - startTime,
          success: true,
        });
      } catch {}
    } catch (err) {
      try {
        logEvent(AnalyticsEvents.SKILL_INSTALL_FAILED, {
          skill_id: skillId,
          error_type: err instanceof Error ? err.name : "UnknownError",
          error_message: err instanceof Error ? err.message : String(err),
        });
      } catch {}
      throw err;
    }
  }, [install, logEvent, source]);

  const getInstallProgress = useCallback(
    (skill: InstallableSkill | string): number => getProgress(skill)?.progress ?? 0,
    [getProgress]
  );

  return (
    <div className="flex h-full min-h-0 flex-col p-6">
      <header className="mb-6 flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold font-serif">
            {t("skillsMarket.title")}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("skillsMarket.subtitle")}
          </p>
        </div>
      </header>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SkillSourceTabs
          source={source}
          onSourceChange={handleSourceChange}
          className="lg:flex-1"
        />
        <SearchBar
          value={searchQuery}
          onChange={handleSearch}
          placeholder={t("skillsMarket.searchPlaceholder")}
          className="w-full lg:w-80"
        />
      </div>

      <div
        ref={scrollRef}
        data-testid="skills-market-scroll"
        className="min-h-0 flex-1 overflow-y-auto pr-1"
      >
        {source === "official" ? (
          <OfficialSkillGrid
            searchQuery={searchQuery}
            onViewDetails={handleViewDetails}
            onInstall={handleInstall}
            isInstalled={isInstalled}
            isInstalling={isInstalling}
            getProgress={getInstallProgress}
          />
        ) : (
          <CommunitySkillGrid
            searchQuery={searchQuery}
            onViewDetails={handleViewDetails}
            onInstall={handleInstall}
            isInstalled={isInstalled}
            isInstalling={isInstalling}
            getProgress={getInstallProgress}
          />
        )}
      </div>

      <SkillDetail
        skill={selectedSkill}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        isInstalled={selectedSkill ? isInstalled(selectedSkill) : false}
        isInstalling={selectedSkill ? isInstalling(selectedSkill) : false}
        installProgress={
          selectedSkill ? getInstallProgress(selectedSkill) : 0
        }
        onInstall={handleInstall}
      />
    </div>
  );
}
