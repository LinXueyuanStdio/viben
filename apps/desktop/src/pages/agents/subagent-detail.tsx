/**
 * SubAgent Detail Page (Agent Config from .claude/agents/*.md)
 *
 * Two-column layout with tabs following skill-detail pattern:
 * - Left: File tree showing config file(s)
 * - Right: Tabs + Code editor / Overview
 *
 * Route: /subagent/:configId?workspace_path=...&executor_type=...
 */
import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Bot,
  Loader2,
  FileText,
  File,
  X,
} from "lucide-react";
import { PageWrapper } from "@/components/layout";
import { WorkspaceHeader } from "@/components/workspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  useWorkspaceParam,
  buildWorkspaceUrl,
  useConfigFileContent,
  useConfigFileWriter,
  useConfigFiles,
  getParentDir,
} from "@/hooks";
import { useWorkspaceAgentConfigs } from "@/hooks/use-agent-configs";
import { useTranslation } from "react-i18next";
import { FileTree, CodeEditor } from "@/components/skill-files";
import { usePageTabs } from "@/hooks/use-page-tabs";
import type { SkillFileEntry } from "@/types";
import { SubAgentOverview } from "./components";
import type { FileTab } from "./types";

// ============================================================================
// Main Component
// ============================================================================

export function SubAgentDetailPage() {
  const { t } = useTranslation();
  const { navigateTo } = usePageTabs();
  const [searchParams] = useSearchParams();
  const { configId } = useParams<{ configId: string }>();

  // Get workspace and executor from query params
  const workspacePathParam = searchParams.get("workspace_path");
  const executorType = searchParams.get("executor_type") || "CLAUDE_CODE";
  const { workspacePath, workspace } = useWorkspaceParam({});

  // Use workspace_path from query params if provided
  const effectiveWorkspacePath = workspacePathParam || workspacePath;

  // Load agent configs (subagents from .claude/agents/*.md)
  const { configs, loading } = useWorkspaceAgentConfigs(
    effectiveWorkspacePath || null,
    executorType
  );

  // Find the specific config
  const config = configs.find((c) => c.id === configId);

  // File operations
  const configDir = config?.path ? getParentDir(config.path) : null;
  const { files, loading: filesLoading, error: filesError, loadFiles } = useConfigFiles(configDir);
  const { content: fileContent, loading: fileLoading, error: fileError, readFile, clearContent } = useConfigFileContent();
  const { saveStatus, writeFile, resetStatus } = useConfigFileWriter();

  // Tab management
  const [openTabs, setOpenTabs] = useState<FileTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("overview");
  const [copied, setCopied] = useState(false);

  // Initialize with overview tab
  useEffect(() => {
    if (config && openTabs.length === 0) {
      setOpenTabs([{
        id: "overview",
        path: "",
        name: t("workspace.overview"),
        type: "overview",
      }]);
      setActiveTabId("overview");
    }
  }, [config, openTabs.length, t]);

  // Load files when config path changes
  useEffect(() => {
    if (configDir) {
      loadFiles(3);
    }
  }, [configDir, loadFiles]);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectOverview = () => {
    const overviewTab = openTabs.find(t => t.type === "overview");
    if (!overviewTab) {
      const newTab: FileTab = {
        id: "overview",
        path: "",
        name: t("workspace.overview"),
        type: "overview",
      };
      setOpenTabs(prev => [newTab, ...prev]);
    }
    setActiveTabId("overview");
    clearContent();
    resetStatus();
  };

  const handleSelectFile = (entry: SkillFileEntry) => {
    if (entry.is_directory) return;

    const existingTab = openTabs.find(t => t.path === entry.path);
    if (!existingTab) {
      const newTab: FileTab = {
        id: entry.path,
        path: entry.path,
        name: entry.name,
        type: "file",
      };
      setOpenTabs(prev => [...prev, newTab]);
    }
    setActiveTabId(entry.path);
    resetStatus();
    readFile(entry.path);
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTabs = openTabs.filter(t => t.id !== tabId);
    setOpenTabs(newTabs);

    if (activeTabId === tabId) {
      if (newTabs.length > 0) {
        const lastTab = newTabs[newTabs.length - 1];
        setActiveTabId(lastTab.id);
        if (lastTab.type === "file") {
          readFile(lastTab.path);
        } else {
          clearContent();
        }
      } else {
        // Reopen overview tab
        const overviewTab: FileTab = {
          id: "overview",
          path: "",
          name: t("workspace.overview"),
          type: "overview",
        };
        setOpenTabs([overviewTab]);
        setActiveTabId("overview");
        clearContent();
      }
    }
  };

  const handleTabClick = (tab: FileTab) => {
    setActiveTabId(tab.id);
    if (tab.type === "file") {
      readFile(tab.path);
    } else {
      clearContent();
    }
  };

  const handleSaveFile = async (content: string) => {
    const activeTab = openTabs.find(t => t.id === activeTabId);
    if (activeTab?.type === "file") {
      await writeFile(activeTab.path, content);
    }
  };

  const handleNavigateBack = () => {
    const url = buildWorkspaceUrl(
      `/executor/${executorType}`,
      effectiveWorkspacePath || undefined
    );
    navigateTo(url, {
      type: "workspace",
      slug: executorType,
      name: executorType,
      icon: { type: "lucide", value: "terminal" },
    });
  };

  const activeTab = openTabs.find(t => t.id === activeTabId);

  if (loading) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageWrapper>
    );
  }

  if (!config) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Bot className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {t("settingsAgents.subagentNotFound", "SubAgent Not Found")}
          </h2>
          <p className="text-muted-foreground mb-4">
            {t("settingsAgents.subagentNotFoundDesc", "The requested subagent configuration could not be found.")}
          </p>
          <Button onClick={handleNavigateBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("common.back")}
          </Button>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper className="flex flex-col h-full">
      {/* Header */}
      {workspace ? (
        <WorkspaceHeader
          workspace={workspace}
          segments={[
            {
              label: executorType,
              href: buildWorkspaceUrl(`/executor/${executorType}`, effectiveWorkspacePath || undefined),
            },
            {
              label: config.name,
              href: "#",
            },
          ]}
          showRefresh={false}
          showRemove={false}
        />
      ) : (
        <div className="p-4 border-b flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleNavigateBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Bot className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <h1 className="font-semibold">{config.name}</h1>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  <Bot className="h-3 w-3 mr-1" />
                  {t("settingsAgents.subagent", "SubAgent")}
                </Badge>
                {config.model && (
                  <Badge variant="secondary" className="text-xs font-mono">
                    {config.model}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar - File Tree */}
        <div className="w-64 border-r flex flex-col bg-muted/30">
          <div className="p-3 border-b flex items-center gap-2">
            <Bot className="h-4 w-4 text-violet-500" />
            <span className="text-sm font-medium truncate">{config.name}</span>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2">
              {/* Overview Entry */}
              <button
                onClick={handleSelectOverview}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left mb-1",
                  "hover:bg-accent transition-colors",
                  activeTabId === "overview" && "bg-accent"
                )}
              >
                <FileText className="h-4 w-4 text-blue-500" />
                <span className="font-medium">{t("workspace.overview")}</span>
              </button>

              {/* Separator */}
              {config.path && <div className="border-t my-2" />}

              {/* File Tree */}
              {config.path && (
                filesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filesError ? (
                  <div className="p-2 text-sm text-muted-foreground">{filesError}</div>
                ) : (
                  <FileTree
                    files={files}
                    selectedPath={activeTab?.type === "file" ? activeTab.path : null}
                    onSelectFile={handleSelectFile}
                  />
                )
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Tabs Bar */}
          {openTabs.length > 0 && (
            <div className="border-b bg-muted/20">
              <div className="flex overflow-x-auto">
                {openTabs.map((tab) => (
                  <div
                    key={tab.id}
                    onClick={() => handleTabClick(tab)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 border-r cursor-pointer text-sm",
                      "hover:bg-accent/50 transition-colors",
                      activeTabId === tab.id
                        ? "bg-background border-b-2 border-b-primary"
                        : "bg-muted/30"
                    )}
                  >
                    {tab.type === "overview" ? (
                      <FileText className="h-3.5 w-3.5 text-blue-500" />
                    ) : (
                      <File className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="truncate max-w-[120px]">{tab.name}</span>
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
          <div className="flex-1 overflow-hidden">
            {activeTab?.type === "overview" ? (
              <SubAgentOverview config={config} onCopy={handleCopy} copied={copied} />
            ) : activeTab?.type === "file" ? (
              fileLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : fileError ? (
                <div className="p-4 text-sm text-muted-foreground">{fileError}</div>
              ) : fileContent !== null ? (
                <CodeEditor
                  value={fileContent}
                  filename={activeTab.name}
                  height="100%"
                  onSave={handleSaveFile}
                  saveStatus={saveStatus}
                />
              ) : null
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>{t("workspace.selectFileToView")}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
