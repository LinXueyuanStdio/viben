/**
 * Agent Settings Tab Component
 *
 * Settings tab with left navigation menu and right unified content area.
 * - Left side: Flat navigation menu with Overview and configuration sections
 * - Right side: Single scrollable list: Overview followed by configuration details
 */
import * as React from "react";
import { useRef, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  FileText,
  Cpu,
  Wrench,
  Brain,
  Variable,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  AgentOverviewPanel,
  type AgentOverviewPanelProps,
} from "./agent-overview-panel";
import {
  AgentConfigPanel,
  type AgentConfigPanelProps,
  type AgentConfigPanelRef,
  type ConfigSectionId,
} from "./agent-config-panel";

// ============================================================================
// Types
// ============================================================================

interface ConfigSubsection {
  id: ConfigSectionId;
  labelKey: string;
  icon: React.ReactNode;
}

type NavSectionId = "overview" | ConfigSectionId;

interface NavSection {
  id: NavSectionId;
  labelKey: string;
  icon: React.ReactNode;
}

export interface AgentSettingsTabProps
  extends AgentOverviewPanelProps,
    Omit<AgentConfigPanelProps, "agentName"> {
  className?: string;
}

// ============================================================================
// Configuration Subsections
// ============================================================================

const CONFIG_SUBSECTIONS: ConfigSubsection[] = [
  { id: "prompts", labelKey: "agentDetail.prompts", icon: <FileText className="h-3.5 w-3.5" /> },
  { id: "model", labelKey: "agentDetail.model", icon: <Cpu className="h-3.5 w-3.5" /> },
  { id: "capabilities", labelKey: "agentDetail.capabilities", icon: <Wrench className="h-3.5 w-3.5" /> },
  { id: "memory", labelKey: "agentDetail.memory", icon: <Brain className="h-3.5 w-3.5" /> },
  { id: "variables", labelKey: "agentDetail.variables", icon: <Variable className="h-3.5 w-3.5" /> },
];

const NAV_SECTIONS: NavSection[] = [
  { id: "overview", labelKey: "agentDetail.overview", icon: <LayoutDashboard className="h-4 w-4" /> },
  ...CONFIG_SUBSECTIONS.map((section) => ({
    ...section,
    icon: React.cloneElement(section.icon as React.ReactElement<{ className?: string }>, {
      className: "h-4 w-4",
    }),
  })),
];

// ============================================================================
// Navigation Item Component
// ============================================================================

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function NavItem({
  icon,
  label,
  isActive,
  onClick,
}: NavItemProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onClick();
  };

  return (
    <button
      type="button"
      role="button"
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer",
        "hover:bg-muted/50",
        isActive && "bg-primary/10 text-primary font-medium",
        !isActive && "text-muted-foreground"
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 text-left truncate">{label}</span>
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AgentSettingsTab(props: AgentSettingsTabProps) {
  const { t } = useTranslation();
  const {
    // Overview panel props
    name,
    description,
    isTemplate,
    templateDescription,
    templateTags,
    agentDir,
    configPath,
    isWorkspaceScoped,
    onNameChange,
    onDescriptionChange,
    onIsTemplateChange,
    onTemplateDescriptionChange,
    onTemplateTagsChange,
    onOpenFolder,
    onCopyPath,

    // Config panel props
    systemPrompt,
    appendPrompt,
    model,
    temperature,
    executorType,
    permissionMode,
    models,
    executors,
    selectedMcpServers,
    selectedSkills,
    customVariables,
    envVariables,
    workspaceName,
    workspacePath,
    onSystemPromptChange,
    onAppendPromptChange,
    onModelChange,
    onTemperatureChange,
    onExecutorTypeChange,
    onPermissionModeChange,
    onCheckAvailability,
    availability,
    checkingAvailability,
    providerConstraintHint,
    onConfigureMcp,
    onConfigureSkills,
    onMcpServersChange,
    onRemoveMcpServer,
    onRemoveSkill,
    onEditMemory,
    onViewTodayLog,
    onViewYesterdayLog,
    executorConfig,
    onExecutorConfigChange,
    onCustomVariablesChange,
    onEnvVariablesChange,

    className,
  } = props;

  // Ref to config panel for scroll-to-section
  const configPanelRef = useRef<AgentConfigPanelRef>(null);
  const overviewRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<NavSectionId>("overview");

  const handleNavClick = useCallback((sectionId: NavSectionId) => {
    setActiveSection(sectionId);
    if (sectionId === "overview") {
      overviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    configPanelRef.current?.scrollToSection(sectionId);
  }, []);

  return (
    <div className={cn("flex h-full", className)}>
      {/* Left Navigation */}
      <div className="w-48 shrink-0 border-r">
        <ScrollArea className="h-full">
          <nav className="p-2 space-y-1">
            {NAV_SECTIONS.map((section) => (
              <NavItem
                key={section.id}
                icon={section.icon}
                label={t(section.labelKey)}
                isActive={activeSection === section.id}
                onClick={() => handleNavClick(section.id)}
              />
            ))}
          </nav>
        </ScrollArea>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div ref={overviewRef} id="overview">
            <AgentOverviewPanel
              name={name}
              description={description}
              isTemplate={isTemplate}
              templateDescription={templateDescription}
              templateTags={templateTags}
              agentDir={agentDir}
              configPath={configPath}
              isWorkspaceScoped={isWorkspaceScoped}
              onNameChange={onNameChange}
              onDescriptionChange={onDescriptionChange}
              onIsTemplateChange={onIsTemplateChange}
              onTemplateDescriptionChange={onTemplateDescriptionChange}
              onTemplateTagsChange={onTemplateTagsChange}
              onOpenFolder={onOpenFolder}
              onCopyPath={onCopyPath}
            />
          </div>
          <AgentConfigPanel
            ref={configPanelRef}
            systemPrompt={systemPrompt}
            appendPrompt={appendPrompt}
            model={model}
            temperature={temperature}
            executorType={executorType}
            permissionMode={permissionMode}
            models={models}
            executors={executors}
            selectedMcpServers={selectedMcpServers}
            selectedSkills={selectedSkills}
            customVariables={customVariables}
            envVariables={envVariables}
            workspaceName={workspaceName}
            workspacePath={workspacePath}
            agentName={name}
            onSystemPromptChange={onSystemPromptChange}
            onAppendPromptChange={onAppendPromptChange}
            onModelChange={onModelChange}
            onTemperatureChange={onTemperatureChange}
            onExecutorTypeChange={onExecutorTypeChange}
            onPermissionModeChange={onPermissionModeChange}
            onCheckAvailability={onCheckAvailability}
            availability={availability}
            checkingAvailability={checkingAvailability}
            providerConstraintHint={providerConstraintHint}
            onConfigureMcp={onConfigureMcp}
            onConfigureSkills={onConfigureSkills}
            onMcpServersChange={onMcpServersChange}
            onRemoveMcpServer={onRemoveMcpServer}
            onRemoveSkill={onRemoveSkill}
            discoveredSkills={props.discoveredSkills}
            discoveredSkillsLoading={props.discoveredSkillsLoading}
            onEditMemory={onEditMemory}
            onViewTodayLog={onViewTodayLog}
            onViewYesterdayLog={onViewYesterdayLog}
            executorConfig={executorConfig}
            onExecutorConfigChange={onExecutorConfigChange}
            onCustomVariablesChange={onCustomVariablesChange}
            onEnvVariablesChange={onEnvVariablesChange}
            embedded
          />
        </ScrollArea>
      </div>
    </div>
  );
}
