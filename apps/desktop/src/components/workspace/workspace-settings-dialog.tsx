import * as React from "react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Settings,
  FolderOpen,
  Server,
  Sparkles,
  Bot,
  Info,
  ExternalLink,
  Clock,
  Copy,
  Check,
} from "lucide-react";
import { GithubIcon as Github } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useLocalWorkspaces } from "@/hooks/use-workspaces";
import { useExecutors, useAgents } from "@/hooks/use-workspace-resources";
import { open as openPath } from "@tauri-apps/plugin-shell";
import { toast } from "@/hooks/use-toast";
import type { Workspace } from "@/types";
import { GitHubAuth, GitHubRepository } from "./github";
import { useGitHubAuth, useGitHubRepository } from "@/hooks/use-github";

// Settings section type
type WorkspaceSettingsSection = "general" | "executors" | "agents" | "mcp" | "skills" | "github" | "about";

// Section configuration
interface SectionConfig {
  id: WorkspaceSettingsSection;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SECTIONS: SectionConfig[] = [
  { id: "general", labelKey: "workspaceSettings.sections.general", icon: Settings },
  { id: "executors", labelKey: "workspaceSettings.sections.executors", icon: Server },
  { id: "agents", labelKey: "workspaceSettings.sections.agents", icon: Bot },
  { id: "mcp", labelKey: "workspaceSettings.sections.mcp", icon: Server },
  { id: "skills", labelKey: "workspaceSettings.sections.skills", icon: Sparkles },
  { id: "github", labelKey: "workspaceSettings.sections.github", icon: Github },
  { id: "about", labelKey: "workspaceSettings.sections.about", icon: Info },
];

// Easing curves
const easeOutExpo = [0.16, 1, 0.3, 1] as const;

// Settings item component
interface SettingsItemProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

function SettingsItem({ title, description, children }: SettingsItemProps) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-border last:border-b-0">
      <div className="flex-1 pr-4">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// Section header component
interface SectionHeaderProps {
  title: string;
}

function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <h3 className="text-base font-semibold text-foreground mt-6 mb-2 first:mt-0">
      {title}
    </h3>
  );
}

interface WorkspaceSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | null;
}

export function WorkspaceSettingsDialog({
  open,
  onOpenChange,
  workspaceId,
}: WorkspaceSettingsDialogProps) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const { getWorkspace } = useLocalWorkspaces();

  const [activeSection, setActiveSection] = useState<WorkspaceSettingsSection>("general");

  // Get workspace data
  const workspace = workspaceId ? getWorkspace(workspaceId) : null;

  // Reset to general section when dialog opens
  useEffect(() => {
    if (open) {
      setActiveSection("general");
    }
  }, [open]);

  // Animation variants
  const tabContentVariants = {
    initial: {
      opacity: 0,
      x: prefersReducedMotion ? 0 : 20,
    },
    animate: {
      opacity: 1,
      x: 0,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.3,
        ease: easeOutExpo,
      },
    },
    exit: {
      opacity: 0,
      x: prefersReducedMotion ? 0 : -20,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.2,
      },
    },
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : 0.05,
        delayChildren: prefersReducedMotion ? 0 : 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.3,
        ease: easeOutExpo,
      },
    },
  };

  // Render section content
  const renderSectionContent = () => {
    if (!workspace) return null;

    switch (activeSection) {
      case "general":
        return <GeneralSection key="general" workspace={workspace} />;
      case "executors":
        return <ExecutorsSection key="executors" workspace={workspace} />;
      case "agents":
        return <AgentsSection key="agents" workspace={workspace} />;
      case "mcp":
        return <McpSection key="mcp" workspace={workspace} />;
      case "skills":
        return <SkillsSection key="skills" workspace={workspace} />;
      case "github":
        return <GitHubSettingsSection key="github" workspace={workspace} />;
      case "about":
        return <AboutSection key="about" workspace={workspace} />;
      default:
        return null;
    }
  };

  if (!workspace) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[90vw] h-[85vh] p-0 gap-0 overflow-hidden">
        <motion.div
          className="h-full flex flex-col md:flex-row"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Left Navigation Sidebar */}
          <motion.nav
            className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r bg-muted/30 p-4"
            variants={itemVariants}
          >
            <div className="flex items-center gap-2 mb-4 px-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold font-serif truncate">
                {workspace.name}
              </h1>
            </div>
            <ul className="space-y-1">
              {SECTIONS.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;

                return (
                  <li key={section.id}>
                    <button
                      onClick={() => setActiveSection(section.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm",
                        "transition-all duration-200",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        isActive
                          ? [
                              "bg-primary text-primary-foreground font-medium",
                              "shadow-sm",
                            ]
                          : [
                              "text-muted-foreground",
                              "hover:bg-muted hover:text-foreground",
                            ]
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          "transition-transform duration-200",
                          isActive && "scale-110"
                        )}
                      />
                      <span>{t(section.labelKey)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.nav>

          {/* Right Content Area */}
          <div className="flex-1 overflow-auto p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                variants={tabContentVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="max-w-2xl"
              >
                {renderSectionContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

/* -----------------------------------------------------------------------------
 * General Section
 * -------------------------------------------------------------------------- */

interface SectionProps {
  workspace: Workspace;
}

function GeneralSection({ workspace }: SectionProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(workspace.path);
      setCopied(true);
      toast.success(t("common.copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("common.copyFailed"));
    }
  };

  const handleOpenInFinder = async () => {
    try {
      await openPath(workspace.path);
    } catch (error) {
      console.error("Failed to open path:", error);
      toast.error(t("workspaceSettings.openFolderFailed"));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-serif mb-1">
          {t("workspaceSettings.sections.general")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("workspaceSettings.generalDescription")}
        </p>
      </div>

      {/* Basic Info */}
      <div className="rounded-xl border bg-card p-4">
        <SectionHeader title={t("workspaceSettings.basicInfo")} />

        <SettingsItem
          title={t("workspaceSettings.name")}
          description={t("workspaceSettings.nameDescription")}
        >
          <span className="text-sm font-medium">{workspace.name}</span>
        </SettingsItem>

        <SettingsItem
          title={t("workspaceSettings.type")}
          description={t("workspaceSettings.typeDescription")}
        >
          <span className={cn(
            "text-xs px-2 py-1 rounded-full",
            workspace.type === "global"
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          )}>
            {workspace.type === "global"
              ? t("workspace.global")
              : t("workspace.custom")}
          </span>
        </SettingsItem>
      </div>

      {/* Path */}
      <div className="rounded-xl border bg-card p-4">
        <SectionHeader title={t("workspaceSettings.location")} />

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              value={workspace.path}
              readOnly
              className="flex-1 font-mono text-xs"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyPath}
              className="shrink-0"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleOpenInFinder}
              className="shrink-0"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("workspaceSettings.pathDescription")}
          </p>
        </div>
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * Executors Section
 * -------------------------------------------------------------------------- */

function ExecutorsSection({ workspace }: SectionProps) {
  const { t } = useTranslation();
  const { executors, loading } = useExecutors({ workspacePath: workspace.path });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-serif mb-1">
          {t("workspaceSettings.sections.executors")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("workspaceSettings.executorsDescription")}
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : executors.length > 0 ? (
          <div className="space-y-3">
            {executors.map((executor) => (
              <div
                key={executor.type}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Server className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">{executor.name}</h4>
                    <p className="text-xs text-muted-foreground">{executor.type}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Server className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              {t("workspaceSettings.noExecutors")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * Agents Section
 * -------------------------------------------------------------------------- */

function AgentsSection({ workspace }: SectionProps) {
  const { t } = useTranslation();
  const { agents, loading } = useAgents({ workspacePath: workspace.path });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-serif mb-1">
          {t("workspaceSettings.sections.agents")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("workspaceSettings.agentsDescription")}
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : agents.length > 0 ? (
          <div className="space-y-3">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">{agent.name}</h4>
                    {agent.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {agent.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Bot className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              {t("workspaceSettings.noAgents")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * MCP Section
 * -------------------------------------------------------------------------- */

function McpSection(_props: SectionProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-serif mb-1">
          {t("workspaceSettings.sections.mcp")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("workspaceSettings.mcpDescription")}
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="text-center py-8">
          <Server className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            {t("workspaceSettings.mcpComingSoon")}
          </p>
        </div>
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * Skills Section
 * -------------------------------------------------------------------------- */

function SkillsSection(_props: SectionProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-serif mb-1">
          {t("workspaceSettings.sections.skills")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("workspaceSettings.skillsDescription")}
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="text-center py-8">
          <Sparkles className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            {t("workspaceSettings.skillsComingSoon")}
          </p>
        </div>
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * GitHub Settings Section (Authentication & Repository Connection)
 * -------------------------------------------------------------------------- */

function GitHubSettingsSection({ workspace }: SectionProps) {
  const { t } = useTranslation();
  const auth = useGitHubAuth(workspace.path);
  const repo = useGitHubRepository(workspace.path);

  const isAuthenticated = auth.status?.authenticated ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-serif mb-1 flex items-center gap-2">
          <Github className="h-5 w-5" />
          {t("workspaceSettings.github.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("workspaceSettings.github.description")}
        </p>
      </div>

      {/* Authentication Card */}
      <div className="rounded-xl border bg-card p-4">
        <GitHubAuth
          status={auth.status}
          loading={auth.loading}
          error={auth.error}
          onAuthenticateGhCli={auth.authenticateWithGhCli}
          onAuthenticatePAT={auth.authenticateWithPAT}
          onSignOut={auth.signOut}
        />
      </div>

      {/* Repository Card (only shown when authenticated) */}
      {isAuthenticated && (
        <div className="rounded-xl border bg-card p-4">
          <GitHubRepository
            repository={repo.repository}
            detectedRepository={repo.detectedRepository}
            loading={repo.loading}
            error={repo.error}
            onConnect={repo.connectRepository}
            onDisconnect={repo.disconnectRepository}
          />
        </div>
      )}

      {/* Hint about sidebar */}
      {isAuthenticated && repo.repository && (
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground bg-muted/50 rounded-lg border border-dashed">
          <Github className="h-4 w-4 shrink-0" />
          <span>{t("workspaceSettings.github.sidebarHint")}</span>
        </div>
      )}
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * About Section
 * -------------------------------------------------------------------------- */

function AboutSection({ workspace }: SectionProps) {
  const { t } = useTranslation();

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-serif mb-1">
          {t("workspaceSettings.sections.about")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("workspaceSettings.aboutDescription")}
        </p>
      </div>

      {/* Workspace Info */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 rounded-xl bg-primary/10">
            <FolderOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">{workspace.name}</h3>
            <p className="text-sm text-muted-foreground">
              {workspace.type === "global"
                ? t("workspace.global")
                : t("workspace.custom")}
            </p>
          </div>
        </div>
      </div>

      {/* Timestamps */}
      <div className="rounded-xl border bg-card p-4">
        <SectionHeader title={t("workspaceSettings.timestamps")} />

        <SettingsItem
          title={t("workspaceSettings.created")}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{formatDate(workspace.created_at)}</span>
          </div>
        </SettingsItem>

        <SettingsItem
          title={t("workspaceSettings.lastAccessed")}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{formatDate(workspace.last_accessed)}</span>
          </div>
        </SettingsItem>
      </div>

      {/* Workspace ID */}
      <div className="rounded-xl border bg-card p-4">
        <SectionHeader title={t("workspaceSettings.technical")} />

        <SettingsItem
          title={t("workspaceSettings.workspaceId")}
          description={t("workspaceSettings.workspaceIdDescription")}
        >
          <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
            {workspace.id.length > 20
              ? `${workspace.id.slice(0, 20)}...`
              : workspace.id}
          </code>
        </SettingsItem>
      </div>
    </div>
  );
}
