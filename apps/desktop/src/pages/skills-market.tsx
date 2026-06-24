import { useCallback, useRef, useState } from "react";
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

export function SkillsMarketPage() {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [source, setSource] = useState<SkillSource>("official");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<SkillDetailItem | null>(
    null
  );
  const [detailOpen, setDetailOpen] = useState(false);
  const { install, isInstalled, isInstalling, getProgress } = useSkillInstall();

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
  }, []);

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
          onChange={setSearchQuery}
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
            onInstall={install}
            isInstalled={isInstalled}
            isInstalling={isInstalling}
            getProgress={getInstallProgress}
          />
        ) : (
          <CommunitySkillGrid
            searchQuery={searchQuery}
            onViewDetails={handleViewDetails}
            onInstall={install}
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
        onInstall={install}
      />
    </div>
  );
}
