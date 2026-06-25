import type { CloudSkillPackage } from "@/hooks/use-cloud-skills";
import type { ClawhubSkillDisplay } from "@/types/clawhub-registry";

export type SkillSource = "official" | "community";

export type CommunitySkillSortOption = "latest" | "popular" | "downloads";

export type SkillDetailItem =
  | { source: "community"; data: CloudSkillPackage }
  | { source: "official"; data: ClawhubSkillDisplay };

export type InstallableSkill = SkillDetailItem;

export interface SkillInstallVisualState {
  isInstalled?: boolean;
  isInstalling?: boolean;
  installProgress?: number;
}
