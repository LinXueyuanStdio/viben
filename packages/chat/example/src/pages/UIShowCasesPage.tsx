import {
  BackgroundTaskList,
  CommandQueuePanel,
  ContextDetailsPopover,
  EmojiPicker,
  ExecApproval,
  PlanApproval,
  QuestionInput,
  SkillsConfigPopover,
  ToolExecutionItem,
  ToolsConfigPopover,
  TodoListPanel,
  getModelIcon,
} from "@viben/chat"
import type {
  AgentMessage,
  BackgroundTaskItem,
  ContextTokenBreakdown,
  PendingExecApproval,
  PendingQuestion,
  SkillConfig,
  TaskPlan,
  ToolConfig,
  CommandQueueItem,
  ModelOption,
} from "@viben/chat"
import { ChevronDown, Pause, Play, Plus, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { UI_DESIGN_SHOWCASE_DEMOS, UI_DESIGN_SHOWCASE_GROUPS } from "../UIDesignShowcaseData"
import type { UIShowcaseDemoId } from "../UIDesignShowcaseData"
import { DashboardCard, SectionLabel } from "../components/common"

export type UIShowcaseComponentDemoItem = {
  id: UIShowcaseDemoId
  label: string
  description: string
  active: boolean
  onClick: () => void
}

export type UIShowCasesPageProps = {
  isChatAppFull: boolean
  activeComponentLabel: string | null
  componentDemoItems: UIShowcaseComponentDemoItem[]
  standaloneQueueItems: CommandQueueItem[]
  models: ModelOption[]
  tools: ToolConfig[]
  skills: SkillConfig[]
  contextBreakdown: ContextTokenBreakdown
  showToolsPanel: boolean
  showSkillsPanel: boolean
  showContextPanel: boolean
  onToggleToolsPanel: () => void
  onToggleSkillsPanel: () => void
  onToggleContextPanel: () => void
  onToggleTool: (toolId: string) => void
  onToggleSkill: (skillId: string) => void
  onInspectTool: (message: AgentMessage) => void
}

export type UIShowcaseDemoOverlayProps = {
  activeDemoId: UIShowcaseDemoId | null
  activeComponentLabel: string | null
  plan: TaskPlan
  questions: PendingQuestion
  execApprovals: PendingExecApproval[]
  todoListMessages: AgentMessage[]
  backgroundTaskItems: BackgroundTaskItem[]
  approvalDemoIdx: number
  approvalFeedback: string | null
  standaloneQueueItems: CommandQueueItem[]
  standaloneQueuePaused: boolean
  onDismiss: () => void
  onPlanApprove: () => void
  onPlanReject: () => void
  onQuestionsSubmit: (answers: Record<string, string[]>) => void
  onEmojiSelect: (emoji: string) => void
  onExecDecision: (decision: string, feedback?: string) => void
  onAddQueueItem: () => void
  onToggleQueuePaused: () => void
  onClearQueue: () => void
  onRemoveQueueItem: (id: string) => void
  onPauseQueue: () => void
  onResumeQueue: () => void
}

export function UIShowCasesPage({
  isChatAppFull,
  activeComponentLabel,
  componentDemoItems,
  standaloneQueueItems,
  models,
  tools,
  skills,
  contextBreakdown,
  showToolsPanel,
  showSkillsPanel,
  showContextPanel,
  onToggleToolsPanel,
  onToggleSkillsPanel,
  onToggleContextPanel,
  onToggleTool,
  onToggleSkill,
  onInspectTool,
}: UIShowCasesPageProps) {
  const { t } = useTranslation()

  return (
    <>
      <DashboardCard className={isChatAppFull ? "space-y-3" : "space-y-3 xl:col-span-3"}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-foreground">{t("example.ui_showcase.title", "UI design showcase")}</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t("example.ui_showcase.subtitle", "Display-only component states are grouped separately from the player.")}
            </p>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            {t("example.components.available_count", "{{count}} demos", { count: UI_DESIGN_SHOWCASE_DEMOS.length })}
          </span>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {UI_DESIGN_SHOWCASE_GROUPS.map((group) => (
            <div key={group.id} className="rounded-md border bg-background p-3">
              <SectionLabel>{t(group.labelKey, group.labelFallback)}</SectionLabel>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {t(group.descriptionKey, group.descriptionFallback)}
              </p>
            </div>
          ))}
        </div>
      </DashboardCard>

      <DashboardCard className={isChatAppFull ? "space-y-3" : "space-y-3 xl:col-start-2"}>
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>{t("example.sections.components", "Components")}</SectionLabel>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {activeComponentLabel ?? t("example.components.none_selected", "No demo selected")}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {componentDemoItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              aria-pressed={item.active}
              className={`min-h-14 rounded-md border px-2.5 py-2 text-left transition-colors ${
                item.active
                  ? "border-primary/50 bg-primary/10 text-foreground shadow-sm"
                  : "border-border/60 bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <span className="block truncate text-xs font-medium">{item.label}</span>
              <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{item.description}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between rounded-md bg-muted/40 px-2.5 py-1.5 text-[10px] text-muted-foreground">
          <span>{t("example.components.available_count", "{{count}} demos", { count: componentDemoItems.length })}</span>
          <span>{t("example.components.active_hint", "Selection opens on the right")}</span>
        </div>
      </DashboardCard>

      <DashboardCard className={isChatAppFull ? "space-y-3" : "space-y-3 xl:col-start-1 xl:row-start-2"}>
        <SectionLabel>{t("example.ui_showcase.grouped_states", "Grouped UI states")}</SectionLabel>
        <div className="space-y-3">
          {UI_DESIGN_SHOWCASE_GROUPS.map((group) => (
            <div key={group.id} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-foreground">{t(group.labelKey, group.labelFallback)}</span>
                <span className="text-[10px] text-muted-foreground">
                  {UI_DESIGN_SHOWCASE_DEMOS.filter((demo) => demo.groupId === group.id).length}
                </span>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {UI_DESIGN_SHOWCASE_DEMOS.filter((demo) => demo.groupId === group.id).map((demo) => (
                  <div key={demo.id} className="rounded-md border bg-background p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium text-foreground">{t(demo.labelKey, demo.labelFallback)}</span>
                      {demo.interactive && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                          {t("example.ui_showcase.interactive", "Interactive")}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-[10px] text-muted-foreground">
                      {t(demo.descriptionKey, demo.descriptionFallback, demo.id === "queue" ? { count: standaloneQueueItems.length } : undefined)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {demo.stateLabels.map((stateLabel) => (
                        <span key={stateLabel} className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase text-muted-foreground">
                          {stateLabel}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DashboardCard>

      <DashboardCard className="space-y-3">
        <SectionLabel>{t("example.sections.modelIcons", "Model Icons")}</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {models.map((model) => (
            <div key={model.id} className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
              {getModelIcon(model.id, { size: 12 })}
              <span>{model.name.split(" ").pop()}</span>
            </div>
          ))}
        </div>
      </DashboardCard>

      <DashboardCard className="space-y-3">
        <SectionLabel>{t("example.sections.toolExecution", "ToolExecutionItem (4 states)")}</SectionLabel>
        <div className="space-y-1">
          <ToolExecutionItem tool={{ message: { type: "tool_use", name: "Grep", input: { pattern: "TODO" } } }} status="queued" compact onInspectTool={onInspectTool} />
          <ToolExecutionItem tool={{ message: { type: "tool_use", name: "Bash", input: { command: "pnpm test" } } }} status="executing" compact onInspectTool={onInspectTool} />
          <ToolExecutionItem tool={{ message: { type: "tool_use", name: "Read", input: { file_path: "/src/App.tsx" } }, result: { type: "tool_result", output: "File content here..." } }} status="success" compact onInspectTool={onInspectTool} />
          <ToolExecutionItem tool={{ message: { type: "tool_use", name: "Write", input: { file_path: "/src/utils.ts" } }, result: { type: "tool_result", output: "Permission denied", isError: true } }} status="error" compact onInspectTool={onInspectTool} />
        </div>
      </DashboardCard>

      <DashboardCard className="space-y-3">
        <SectionLabel>{t("example.sections.configPanels", "Config Panels")}</SectionLabel>
        <div className="space-y-2">
          <CollapsibleSection
            title={t("example.config.tools", "Tools ({{enabled}}/{{total}})", { enabled: tools.filter((tool) => tool.enabled).length, total: tools.length })}
            open={showToolsPanel}
            onToggle={onToggleToolsPanel}
          >
            <ToolsConfigPopover
              tools={tools}
              onToggleTool={(toolId) => onToggleTool(toolId)}
              className="!w-full"
            />
          </CollapsibleSection>

          <CollapsibleSection
            title={t("example.config.skills", "Skills ({{enabled}}/{{total}})", { enabled: skills.filter((skill) => skill.enabled).length, total: skills.length })}
            open={showSkillsPanel}
            onToggle={onToggleSkillsPanel}
          >
            <SkillsConfigPopover
              skills={skills}
              onToggleSkill={(skillId) => onToggleSkill(skillId)}
              className="!w-full"
            />
          </CollapsibleSection>

          <CollapsibleSection
            title={t("example.config.context_details", "Context Details")}
            open={showContextPanel}
            onToggle={onToggleContextPanel}
          >
            <ContextDetailsPopover
              breakdown={contextBreakdown}
              className="!w-full"
            />
          </CollapsibleSection>
        </div>
      </DashboardCard>
    </>
  )
}

export function UIShowcaseDemoOverlay({
  activeDemoId,
  activeComponentLabel,
  plan,
  questions,
  execApprovals,
  todoListMessages,
  backgroundTaskItems,
  approvalDemoIdx,
  approvalFeedback,
  standaloneQueueItems,
  standaloneQueuePaused,
  onDismiss,
  onPlanApprove,
  onPlanReject,
  onQuestionsSubmit,
  onEmojiSelect,
  onExecDecision,
  onAddQueueItem,
  onToggleQueuePaused,
  onClearQueue,
  onRemoveQueueItem,
  onPauseQueue,
  onResumeQueue,
}: UIShowcaseDemoOverlayProps) {
  const { t } = useTranslation()
  if (!activeDemoId) return null

  const title = activeComponentLabel ?? getDemoTitle(activeDemoId, t)
  const dismissLabel = t("example.components.dismiss", "Dismiss component demo")

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex min-h-0 items-center justify-center bg-background/80 p-5 backdrop-blur-sm">
      {activeDemoId === "plan" ? (
        <ComponentDemoSurface title={title} onDismiss={onDismiss} dismissLabel={dismissLabel}>
          <div className="w-full max-w-lg">
            <PlanApproval
              plan={plan}
              isPending
              onApprove={onPlanApprove}
              onReject={onPlanReject}
            />
          </div>
        </ComponentDemoSurface>
      ) : activeDemoId === "question" ? (
        <ComponentDemoSurface title={title} onDismiss={onDismiss} dismissLabel={dismissLabel}>
          <div className="w-full max-w-lg">
            <QuestionInput
              questions={questions}
              onSubmit={onQuestionsSubmit}
            />
          </div>
        </ComponentDemoSurface>
      ) : activeDemoId === "emoji" ? (
        <ComponentDemoSurface title={title} onDismiss={onDismiss} dismissLabel={dismissLabel}>
          <EmojiPicker onSelect={onEmojiSelect} />
        </ComponentDemoSurface>
      ) : activeDemoId === "exec" ? (
        <ComponentDemoSurface title={title} onDismiss={onDismiss} dismissLabel={dismissLabel}>
          <div className="w-full max-w-lg space-y-3">
            <ExecApproval
              approval={execApprovals[approvalDemoIdx % execApprovals.length]}
              onDecision={onExecDecision}
            />
            {approvalFeedback && (
              <div className="rounded-md border border-border/60 bg-muted/50 px-3 py-2 text-center text-sm text-muted-foreground animate-in fade-in duration-200">
                {approvalFeedback}
              </div>
            )}
            <p className="text-center text-[11px] text-muted-foreground">
              {t("example.exec_feedback.cycle_hint", "Click sidebar button to cycle through {{count}} scenarios ({{current}}/{{total}})", {
                count: execApprovals.length,
                current: approvalDemoIdx + 1,
                total: execApprovals.length,
              })}
            </p>
          </div>
        </ComponentDemoSurface>
      ) : activeDemoId === "queue" ? (
        <ComponentDemoSurface title={title} onDismiss={onDismiss} dismissLabel={dismissLabel}>
          <div className="w-full max-w-lg space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">{t("example.command_queue.demo_title", "Command Queue Demo")}</h3>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onAddQueueItem}
                  className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Plus className="size-3" />
                  {t("example.command_queue.add_item", "Add item")}
                </button>
                <button
                  type="button"
                  onClick={onToggleQueuePaused}
                  className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors hover:bg-accent hover:text-foreground ${standaloneQueuePaused ? "text-amber-500" : "text-muted-foreground"}`}
                >
                  {standaloneQueuePaused ? <Play className="size-3" /> : <Pause className="size-3" />}
                  {standaloneQueuePaused ? t("example.command_queue.resume", "Resume") : t("example.command_queue.pause", "Pause")}
                </button>
                <button
                  type="button"
                  onClick={onClearQueue}
                  className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  {t("example.command_queue.clear_all", "Clear all")}
                </button>
              </div>
            </div>
            <CommandQueuePanel
              items={standaloneQueueItems}
              isPaused={standaloneQueuePaused}
              onRemove={onRemoveQueueItem}
              onClear={onClearQueue}
              onPause={onPauseQueue}
              onResume={onResumeQueue}
            />
            {standaloneQueueItems.length === 0 && (
              <p className="py-4 text-center text-[11px] text-muted-foreground">
                {t("example.command_queue.empty_hint", "Queue is empty. Click \"Add item\" to add demo items.")}
              </p>
            )}
          </div>
        </ComponentDemoSurface>
      ) : activeDemoId === "todo-list" ? (
        <ComponentDemoSurface title={title} onDismiss={onDismiss} dismissLabel={dismissLabel}>
          <div className="w-full max-w-lg">
            <TodoListPanel messages={todoListMessages} defaultExpanded />
          </div>
        </ComponentDemoSurface>
      ) : activeDemoId === "background-tasks" ? (
        <ComponentDemoSurface title={title} onDismiss={onDismiss} dismissLabel={dismissLabel}>
          <div className="w-full max-w-lg">
            <BackgroundTaskList tasks={backgroundTaskItems} />
          </div>
        </ComponentDemoSurface>
      ) : null}
    </div>
  )
}

function getDemoTitle(id: UIShowcaseDemoId, t: (key: string, fallback: string) => string) {
  const demo = UI_DESIGN_SHOWCASE_DEMOS.find((item) => item.id === id)
  return demo ? t(demo.labelKey, demo.labelFallback) : ""
}

function CollapsibleSection({ title, open, onToggle, children }: {
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-medium transition-colors hover:bg-accent/50"
      >
        {title}
        <ChevronDown className={`size-3.5 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t p-3">
          {children}
        </div>
      )}
    </div>
  )
}

function ComponentDemoSurface({
  title,
  dismissLabel,
  onDismiss,
  children,
}: {
  title: string
  dismissLabel: string
  onDismiss: () => void
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="relative w-full max-w-xl rounded-lg border bg-background p-4 shadow-xl" data-testid="component-demo-surface">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-sm font-medium text-foreground">{title}</span>
          <button
            type="button"
            aria-label={dismissLabel}
            onClick={onDismiss}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex justify-center">
          {children}
        </div>
      </div>
    </div>
  )
}
