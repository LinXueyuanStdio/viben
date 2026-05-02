/**
 * Agent Settings Tab Component
 *
 * Settings tab with left navigation menu and right content area.
 * - Left side: Navigation menu with Overview and Configuration items
 * - Right side: Content area showing selected panel
 * - Configuration has expandable subsections that scroll to specific sections
 */
import * as React from "react";
import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  ChevronDown,
  LayoutDashboard,
  Settings2,
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

type NavPage = "overview" | "configuration";

interface ConfigSubsection {
  id: ConfigSectionId;
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

// ============================================================================
// Navigation Item Component
// ============================================================================

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  hasChildren?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  indent?: boolean;
}

function NavItem({
  icon,
  label,
  isActive,
  onClick,
  hasChildren,
  isExpanded,
  onToggleExpand,
  indent,
}: NavItemProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onClick();
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleExpand?.();
  };

  return (
    <div
      role="button"
      tabIndex={0}
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
        !isActive && "text-muted-foreground",
        indent && "pl-6"
      )}
    >
      {hasChildren && (
        <button
          type="button"
          onClick={handleToggle}
          className="p-0.5 -ml-1 hover:bg-muted rounded transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
      )}
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 text-left truncate">{label}</span>
    </div>
  );
}

// ============================================================================
// Subsection Nav Item (for config sections)
// ============================================================================

interface SubsectionNavItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function SubsectionNavItem({ icon, label, isActive, onClick }: SubsectionNavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 pl-10 pr-3 py-1.5 text-xs rounded-md transition-colors",
        "hover:bg-muted/50",
        isActive && "bg-muted/30 text-foreground",
        !isActive && "text-muted-foreground"
      )}
    >
      <span className="shrink-0 opacity-70">{icon}</span>
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
    planMode,
    approvals,
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
    onPlanModeChange,
    onApprovalsChange,
    onCheckAvailability,
    availability,
    checkingAvailability,
    onConfigureMcp,
    onConfigureSkills,
    onRemoveMcpServer,
    onRemoveSkill,
    onEditMemory,
    onViewTodayLog,
    onViewYesterdayLog,
    onCustomVariablesChange,
    onEnvVariablesChange,

    className,
  } = props;

  // State
  const [activePage, setActivePage] = useState<NavPage>("overview");
  const [configExpanded, setConfigExpanded] = useState(true);
  const [activeSection, setActiveSection] = useState<ConfigSectionId | null>(null);

  // Ref to config panel for scroll-to-section
  const configPanelRef = useRef<AgentConfigPanelRef>(null);

  // Handle clicking on a config subsection
  const handleSubsectionClick = useCallback((sectionId: ConfigSectionId) => {
    setActivePage("configuration");
    setActiveSection(sectionId);
    // Small delay to ensure the config panel is mounted
    setTimeout(() => {
      configPanelRef.current?.scrollToSection(sectionId);
    }, 50);
  }, []);

  // Handle clicking on configuration nav item
  const handleConfigClick = useCallback(() => {
    setActivePage("configuration");
    setActiveSection(null);
  }, []);

  // Handle clicking on overview nav item
  const handleOverviewClick = useCallback(() => {
    setActivePage("overview");
    setActiveSection(null);
  }, []);

  return (
    <div className={cn("flex h-full", className)}>
      {/* Left Navigation */}
      <div className="w-48 shrink-0 border-r">
        <ScrollArea className="h-full">
          <nav className="p-2 space-y-1">
            {/* Overview */}
            <NavItem
              icon={<LayoutDashboard className="h-4 w-4" />}
              label={t("agentDetail.overview")}
              isActive={activePage === "overview"}
              onClick={handleOverviewClick}
            />

            {/* Configuration with expandable subsections */}
            <div className="space-y-0.5">
              <NavItem
                icon={<Settings2 className="h-4 w-4" />}
                label={t("agentDetail.configuration")}
                isActive={activePage === "configuration" && activeSection === null}
                onClick={handleConfigClick}
                hasChildren
                isExpanded={configExpanded}
                onToggleExpand={() => setConfigExpanded(!configExpanded)}
              />

              {/* Subsections */}
              {configExpanded && (
                <div className="space-y-0.5 pt-0.5">
                  {CONFIG_SUBSECTIONS.map((subsection) => (
                    <SubsectionNavItem
                      key={subsection.id}
                      icon={subsection.icon}
                      label={t(subsection.labelKey)}
                      isActive={activePage === "configuration" && activeSection === subsection.id}
                      onClick={() => handleSubsectionClick(subsection.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </nav>
        </ScrollArea>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {activePage === "overview" ? (
          <ScrollArea className="h-full">
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
          </ScrollArea>
        ) : (
          <AgentConfigPanel
            ref={configPanelRef}
            systemPrompt={systemPrompt}
            appendPrompt={appendPrompt}
            model={model}
            temperature={temperature}
            executorType={executorType}
            planMode={planMode}
            approvals={approvals}
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
            onPlanModeChange={onPlanModeChange}
            onApprovalsChange={onApprovalsChange}
            onCheckAvailability={onCheckAvailability}
            availability={availability}
            checkingAvailability={checkingAvailability}
            onConfigureMcp={onConfigureMcp}
            onConfigureSkills={onConfigureSkills}
            onRemoveMcpServer={onRemoveMcpServer}
            onRemoveSkill={onRemoveSkill}
            onEditMemory={onEditMemory}
            onViewTodayLog={onViewTodayLog}
            onViewYesterdayLog={onViewYesterdayLog}
            onCustomVariablesChange={onCustomVariablesChange}
            onEnvVariablesChange={onEnvVariablesChange}
          />
        )}
      </div>
    </div>
  );
}
