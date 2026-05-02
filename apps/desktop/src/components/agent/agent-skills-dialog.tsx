/**
 * Agent Skills Configuration Dialog
 *
 * Dialog for configuring skills for an agent.
 * Allows selecting from installed skills or browsing the marketplace.
 */
import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Sparkles,
  Plus,
  Check,
  ExternalLink,
  Search,
  Loader2,
  X,
  Package,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { cn, setsEqual } from "@/lib/utils";
import { useCloudSkillPackages, type CloudSkillPackage } from "@/hooks/use-cloud-skills";
import { useDesktopRouting } from "@/hooks/use-desktop-routing";

interface Skill {
  id: string;
  name: string;
  description: string | null;
  skillType: string;
  installed: boolean;
}

interface AgentSkillsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSkillIds: string[];
  onSkillsChange: (skillIds: string[]) => void;
}

export function AgentSkillsDialog({
  open,
  onOpenChange,
  selectedSkillIds,
  onSkillsChange,
}: AgentSkillsDialogProps) {
  const { t } = useTranslation();
  const { openSkillsMarket } = useDesktopRouting();
  const { packages, loading: isLoading, error } = useCloudSkillPackages();
  const [localSelected, setLocalSelected] = useState<string[]>(selectedSkillIds);
  const [searchQuery, setSearchQuery] = useState("");

  // Sync local state when dialog opens
  useEffect(() => {
    if (open) {
      setLocalSelected(selectedSkillIds);
      setSearchQuery("");
    }
  }, [open, selectedSkillIds]);

  // Transform packages to skills and filter by search
  const filteredSkills = useMemo(() => {
    const skills: Skill[] = packages.map((pkg: CloudSkillPackage) => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      skillType: pkg.skillType || "general",
      installed: true,
    }));

    if (!searchQuery.trim()) return skills;

    const query = searchQuery.toLowerCase();
    return skills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(query) ||
        skill.description?.toLowerCase().includes(query) ||
        skill.skillType.toLowerCase().includes(query)
    );
  }, [packages, searchQuery]);

  const handleToggleSkill = (skillId: string) => {
    setLocalSelected((prev) =>
      prev.includes(skillId)
        ? prev.filter((id) => id !== skillId)
        : [...prev, skillId]
    );
  };

  const handleSelectAll = () => {
    if (localSelected.length === filteredSkills.length) {
      setLocalSelected([]);
    } else {
      setLocalSelected(filteredSkills.map((s) => s.id));
    }
  };

  const handleSave = () => {
    onSkillsChange(localSelected);
    onOpenChange(false);
  };

  const handleGoToMarketplace = () => {
    onOpenChange(false);
    openSkillsMarket();
  };

  const getSkillTypeBadge = (type: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      automation: { label: t("skillsMarket.typeAutomation"), className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
      analysis: { label: t("skillsMarket.typeAnalysis"), className: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
      generation: { label: t("skillsMarket.typeGeneration"), className: "bg-green-500/10 text-green-600 dark:text-green-400" },
    };
    const variant = variants[type.toLowerCase()] || { label: type, className: "bg-muted" };
    return (
      <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", variant.className)}>
        {variant.label}
      </Badge>
    );
  };

  const hasChanges = !setsEqual(localSelected, selectedSkillIds);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            {t("settingsAgents.configureSkills")}
          </DialogTitle>
          <DialogDescription>
            {t("settingsAgents.configureSkillsDesc")}
          </DialogDescription>
        </DialogHeader>

        {/* Search and Selection Info */}
        <div className="px-6 pb-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("skillsMarket.searchPlaceholder")}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {packages.length > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-2 hover:text-foreground transition-colors"
              >
                <Checkbox
                  checked={localSelected.length === filteredSkills.length && filteredSkills.length > 0}
                  className="h-3.5 w-3.5"
                />
                <span>{t("common.selectAll", { defaultValue: "Select all" })}</span>
              </button>
              <span>
                {localSelected.length} / {packages.length} {t("common.selected", { defaultValue: "selected" })}
              </span>
            </div>
          )}
        </div>

        {/* Skill List */}
        <ScrollArea className="max-h-[280px] px-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-destructive mb-4">
                {t("common.error")}: {error}
              </p>
              <Button variant="outline" size="sm" onClick={handleGoToMarketplace}>
                {t("settingsAgents.browseMarketplace")}
              </Button>
            </div>
          ) : packages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                <Package className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium mb-1">
                {t("settingsAgents.noSkillsAvailable")}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                {t("settingsAgents.noSkillsHint", { defaultValue: "Install skills from the marketplace to extend your agent" })}
              </p>
              <Button variant="default" size="sm" onClick={handleGoToMarketplace}>
                <Plus className="h-4 w-4 mr-2" />
                {t("settingsAgents.browseMarketplace")}
              </Button>
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-muted-foreground">
                {t("skillsMarket.noSearchResults")}
              </p>
            </div>
          ) : (
            <div className="space-y-2 pb-2">
              {filteredSkills.map((skill) => {
                const isSelected = localSelected.includes(skill.id);
                return (
                  <button
                    key={skill.id}
                    onClick={() => handleToggleSkill(skill.id)}
                    className={cn(
                      "w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-left",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      className="shrink-0 mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">
                          {skill.name}
                        </span>
                        {getSkillTypeBadge(skill.skillType)}
                      </div>
                      {skill.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {skill.description}
                        </p>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="p-6 pt-4 border-t bg-muted/30">
          <div className="flex w-full items-center justify-between">
            <Button variant="outline" size="sm" onClick={handleGoToMarketplace}>
              <ExternalLink className="h-4 w-4 mr-2" />
              {t("settingsAgents.browseMore")}
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleSave} disabled={!hasChanges}>
                {t("common.save")}
                {hasChanges && localSelected.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-[10px] px-1.5">
                    {localSelected.length}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
