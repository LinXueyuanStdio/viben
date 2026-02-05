import { useState, useEffect } from "react";
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
  FolderTree,
  X,
  ExternalLink,
  File,
  Edit3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  useLocalWorkspaces,
  useWorkspaceAgents,
  useWorkspaceSkills,
  useSkillReadme,
  useSkillFiles,
  useSkillFileContent,
} from "@/hooks";
import { useTranslation } from "react-i18next";
import { FileTree, CodeEditor } from "@/components/skill-files";
import type { WorkspaceSkill, SkillFileEntry } from "@/types";

interface Tab {
  id: string;
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

  // Auto-open tab for selected skill (useEffect instead of useMemo to avoid side effects)
  useEffect(() => {
    if (selectedSkill) {
      // Check if tab already exists
      const existingTab = openTabs.find((t) => t.id === selectedSkill.id);
      if (!existingTab) {
        const newTab: Tab = {
          id: selectedSkill.id,
          skill: selectedSkill,
        };
        setOpenTabs((prev) => [...prev, newTab]);
      }
      setActiveTabId(selectedSkill.id);
    }
  }, [selectedSkill?.id]); // Only depend on skill ID to avoid infinite loops

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
        <div className="flex-1 overflow-hidden">
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
  const [activeSection, setActiveSection] = useState<"overview" | "files">("overview");

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
          {skill.path && (
            <button
              onClick={() => setActiveSection("files")}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left",
                "hover:bg-accent transition-colors",
                activeSection === "files" && "bg-accent"
              )}
            >
              <FolderTree className="h-4 w-4" />
              {t("workspace.files")}
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {activeSection === "overview" ? (
          <SkillOverview skill={skill} />
        ) : (
          <SkillFilesView skill={skill} />
        )}
      </div>
    </div>
  );
}

function SkillOverview({ skill }: { skill: WorkspaceSkill }) {
  const { t } = useTranslation();
  const { content, loading, error, loadReadme } = useSkillReadme(skill.path || null);

  useEffect(() => {
    if (skill.path) {
      loadReadme();
    }
  }, [skill.path, loadReadme]);

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
            <Sparkles className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold font-serif">{skill.name}</h1>
            <p className="text-muted-foreground mt-1">
              {skill.description || t("workspace.installedSkill")}
            </p>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
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

        {/* Path */}
        {skill.path && (
          <div className="mb-6 space-y-2">
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

        {/* SKILL.md Content */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium">{t("workspace.skillContent")}</h3>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-sm text-muted-foreground py-4 bg-muted/30 rounded-lg px-4">
              {error}
            </div>
          ) : content ? (
            <div className="prose prose-sm dark:prose-invert max-w-none bg-muted/30 rounded-lg p-4">
              <MarkdownRenderer content={content} />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-4">
              {t("workspace.noSkillContent")}
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}

function SkillFilesView({ skill }: { skill: WorkspaceSkill }) {
  const { t } = useTranslation();
  const { files, loading: filesLoading, error: filesError, loadFiles } = useSkillFiles(skill.path || null);
  const { content: fileContent, loading: fileLoading, error: fileError, readFile, clearContent } = useSkillFileContent();
  const [selectedFile, setSelectedFile] = useState<SkillFileEntry | null>(null);

  useEffect(() => {
    if (skill.path) {
      loadFiles(4);
    }
  }, [skill.path, loadFiles]);

  const handleSelectFile = (entry: SkillFileEntry) => {
    setSelectedFile(entry);
    if (!entry.is_directory && skill.path) {
      readFile(entry.path, skill.path);
    } else {
      clearContent();
    }
  };

  if (!skill.path) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>{t("workspace.noSkillPath")}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* File Tree Sidebar */}
      <div className="w-64 border-r overflow-hidden flex flex-col">
        <div className="p-3 border-b">
          <h3 className="text-sm font-medium">{t("workspace.files")}</h3>
        </div>
        <ScrollArea className="flex-1">
          {filesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filesError ? (
            <div className="p-4 text-sm text-muted-foreground">{filesError}</div>
          ) : (
            <FileTree
              files={files}
              selectedPath={selectedFile?.path || null}
              onSelectFile={handleSelectFile}
              className="p-2"
            />
          )}
        </ScrollArea>
      </div>

      {/* File Content Preview */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {selectedFile ? (
          <>
            <div className="p-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-mono truncate">{selectedFile.name}</span>
              </div>
              {!selectedFile.is_directory && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 flex-shrink-0"
                  asChild
                >
                  <a
                    href={`file://${selectedFile.path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Edit3 className="h-3.5 w-3.5 mr-1.5" />
                    {t("workspace.openInEditor")}
                  </a>
                </Button>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              {selectedFile.is_directory ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>{t("workspace.selectFile")}</p>
                </div>
              ) : fileLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : fileError ? (
                <div className="p-4 text-sm text-muted-foreground">{fileError}</div>
              ) : fileContent ? (
                <CodeEditor
                  value={fileContent}
                  filename={selectedFile.name}
                  height="100%"
                />
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>{t("workspace.selectFileToView")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Simple markdown renderer for SKILL.md
function MarkdownRenderer({ content }: { content: string }) {
  // Strip YAML frontmatter
  const contentWithoutFrontmatter = content.replace(/^---[\s\S]*?---\n?/, '');

  // Basic markdown to HTML conversion
  const html = contentWithoutFrontmatter
    // Headers
    .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mt-6 mb-3">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>')
    // Bold
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    // Code blocks
    .replace(/```(\w+)?\n([\s\S]*?)```/gim, '<pre class="bg-muted p-3 rounded-lg text-xs overflow-auto my-3"><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/gim, '<code class="bg-muted px-1.5 py-0.5 rounded text-xs">$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener">$1</a>')
    // Lists
    .replace(/^\- (.*$)/gim, '<li class="ml-4">$1</li>')
    // Paragraphs
    .replace(/\n\n/gim, '</p><p class="my-2">')
    .replace(/\n/gim, '<br/>');

  return (
    <div
      className="markdown-content"
      dangerouslySetInnerHTML={{ __html: `<p class="my-2">${html}</p>` }}
    />
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
