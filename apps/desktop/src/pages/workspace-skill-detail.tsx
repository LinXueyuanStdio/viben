import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bot,
  Sparkles,
  Loader2,
  FolderOpen,
  Package,
  Code,
  FileText,
  Settings,
  X,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  useLocalWorkspaces,
  useWorkspaceAgents,
  useWorkspaceSkills,
} from "@/hooks";
import { useTranslation } from "react-i18next";
import type { WorkspaceSkill } from "@/types";

// Tab types for skill detail
type TabType = "overview" | "config" | "readme";

interface Tab {
  id: string;
  type: TabType;
  skill: WorkspaceSkill;
}

export function WorkspaceSkillDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workspaceId, agentId, skillId } = useParams<{
    workspaceId: string;
    agentId: string;
    skillId: string;
  }>();
  const { getWorkspace } = useLocalWorkspaces();
  const { agents } = useWorkspaceAgents(workspaceId || null);
  const { skills, loading: skillsLoading } = useWorkspaceSkills(
    workspaceId || null,
    agentId || null
  );

  // Tab management
  const [openTabs, setOpenTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const workspace = workspaceId ? getWorkspace(workspaceId) : undefined;
  const agent = agents.find((a) => a.id === agentId);
  const selectedSkill = skills.find((s) => s.id === skillId);

  // Auto-open tab for selected skill
  useMemo(() => {
    if (selectedSkill && !openTabs.find((t) => t.id === selectedSkill.id)) {
      const newTab: Tab = {
        id: selectedSkill.id,
        type: "overview",
        skill: selectedSkill,
      };
      setOpenTabs((prev) => [...prev, newTab]);
      setActiveTabId(selectedSkill.id);
    }
  }, [selectedSkill?.id]);

  if (!workspace || !agent) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Bot className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">
          {t("workspace.agentNotFound")}
        </h2>
        <Button asChild>
          <Link to={workspaceId ? `/workspace/${workspaceId}` : "/"}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("workspace.backToWorkspace")}
          </Link>
        </Button>
      </div>
    );
  }

  const handleSelectSkill = (skill: WorkspaceSkill) => {
    // Navigate to the skill
    navigate(`/workspace/${workspaceId}/agent/${agentId}/skill/${skill.id}`);

    // Open tab if not already open
    if (!openTabs.find((t) => t.id === skill.id)) {
      const newTab: Tab = {
        id: skill.id,
        type: "overview",
        skill,
      };
      setOpenTabs((prev) => [...prev, newTab]);
    }
    setActiveTabId(skill.id);
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTabs = openTabs.filter((t) => t.id !== tabId);
    setOpenTabs(newTabs);

    // If closing active tab, switch to another tab or go back
    if (activeTabId === tabId) {
      if (newTabs.length > 0) {
        const newActiveTab = newTabs[newTabs.length - 1];
        setActiveTabId(newActiveTab.id);
        navigate(`/workspace/${workspaceId}/agent/${agentId}/skill/${newActiveTab.id}`);
      } else {
        setActiveTabId(null);
        navigate(`/workspace/${workspaceId}/agent/${agentId}`);
      }
    }
  };

  const activeTab = openTabs.find((t) => t.id === activeTabId);

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Skill List */}
      <div className="w-64 border-r flex flex-col bg-muted/30">
        {/* Sidebar Header */}
        <div className="p-3 border-b flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
            <Link to={`/workspace/${workspaceId}/agent/${agentId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium truncate">{agent.name}</h3>
            <p className="text-xs text-muted-foreground truncate">
              {t("workspace.skills")}
            </p>
          </div>
        </div>

        {/* Skill Tree */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {skillsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : skills.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>{t("workspace.noSkills")}</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {skills.map((skill) => (
                  <button
                    key={skill.id}
                    onClick={() => handleSelectSkill(skill)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left",
                      "hover:bg-accent transition-colors",
                      skillId === skill.id && "bg-accent"
                    )}
                  >
                    <Sparkles className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    <span className="truncate">{skill.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tabs Bar */}
        {openTabs.length > 0 && (
          <div className="border-b bg-muted/20">
            <div className="flex overflow-x-auto">
              {openTabs.map((tab) => (
                <div
                  key={tab.id}
                  onClick={() => {
                    setActiveTabId(tab.id);
                    navigate(`/workspace/${workspaceId}/agent/${agentId}/skill/${tab.id}`);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 border-r cursor-pointer text-sm",
                    "hover:bg-accent/50 transition-colors",
                    activeTabId === tab.id
                      ? "bg-background border-b-2 border-b-primary"
                      : "bg-muted/30"
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span className="truncate max-w-[120px]">{tab.skill.name}</span>
                  <button
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    className="ml-1 p-0.5 rounded hover:bg-muted"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          {activeTab ? (
            <SkillDetailContent skill={activeTab.skill} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <FolderOpen className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-sm">{t("workspace.selectSkillToView")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface SkillDetailContentProps {
  skill: WorkspaceSkill;
}

function SkillDetailContent({ skill }: SkillDetailContentProps) {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<"overview" | "config">("overview");

  return (
    <div className="h-full flex">
      {/* Secondary Sidebar - Sections */}
      <div className="w-48 border-r bg-muted/10">
        <div className="p-2 space-y-0.5">
          <button
            onClick={() => setActiveSection("overview")}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left",
              "hover:bg-accent transition-colors",
              activeSection === "overview" && "bg-accent"
            )}
          >
            <FileText className="h-4 w-4" />
            {t("workspace.overview")}
          </button>
          <button
            onClick={() => setActiveSection("config")}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left",
              "hover:bg-accent transition-colors",
              activeSection === "config" && "bg-accent"
            )}
          >
            <Settings className="h-4 w-4" />
            {t("workspace.configuration")}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-3xl">
          {activeSection === "overview" ? (
            <SkillOverview skill={skill} />
          ) : (
            <SkillConfig skill={skill} />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function SkillOverview({ skill }: { skill: WorkspaceSkill }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
          <Sparkles className="h-7 w-7" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold font-serif">{skill.name}</h1>
          <p className="text-muted-foreground mt-1">
            {t("workspace.installedSkill")}
          </p>
        </div>
      </div>

      {/* Metadata Grid */}
      <div className="grid grid-cols-2 gap-4">
        <InfoCard
          icon={<Code className="h-4 w-4" />}
          label={t("common.version")}
          value={skill.version}
        />
        <InfoCard
          icon={<Package className="h-4 w-4" />}
          label={t("workspace.source")}
          value={skill.source}
        />
      </div>

      {/* ID */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">{t("workspace.skillId")}</h3>
        <code className="block text-xs bg-muted px-3 py-2 rounded-lg font-mono break-all">
          {skill.id}
        </code>
      </div>

      {/* Path (if local) */}
      {skill.path && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">{t("workspace.installPath")}</h3>
          <code className="block text-xs bg-muted px-3 py-2 rounded-lg font-mono break-all">
            {skill.path}
          </code>
          <Button variant="outline" size="sm" asChild>
            <a href={`file://${skill.path}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-2" />
              {t("workspace.openInFinder")}
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}

function SkillConfig({ skill }: { skill: WorkspaceSkill }) {
  const { t } = useTranslation();

  // Format skill as JSON for display
  const configJson = JSON.stringify(
    {
      id: skill.id,
      name: skill.name,
      version: skill.version,
      source: skill.source,
      ...(skill.path ? { path: skill.path } : {}),
    },
    null,
    2
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">{t("workspace.skillConfiguration")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("workspace.skillConfigDesc")}
        </p>
      </div>

      {/* JSON Config */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">{t("workspace.rawConfig")}</h3>
        <pre className="text-xs bg-muted px-4 py-3 rounded-lg font-mono overflow-auto max-h-96">
          {configJson}
        </pre>
      </div>
    </div>
  );
}

interface InfoCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function InfoCard({ icon, label, value }: InfoCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium text-sm">{value}</p>
      </div>
    </div>
  );
}
