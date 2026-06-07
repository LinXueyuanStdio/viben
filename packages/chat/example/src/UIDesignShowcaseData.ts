export type UIShowcaseGroupId = "interactions" | "feedback" | "configuration"

export type UIShowcaseDemoId =
  | "plan"
  | "question"
  | "emoji"
  | "exec"
  | "queue"
  | "model-icons"
  | "tool-execution"
  | "config-panels"

export type UIShowcaseGroupDefinition = {
  id: UIShowcaseGroupId
  labelKey: string
  labelFallback: string
  descriptionKey: string
  descriptionFallback: string
}

export type UIShowcaseDemoDefinition = {
  id: UIShowcaseDemoId
  groupId: UIShowcaseGroupId
  labelKey: string
  labelFallback: string
  descriptionKey: string
  descriptionFallback: string
  stateLabels: readonly string[]
  interactive: boolean
}

export const UI_DESIGN_SHOWCASE_GROUPS: UIShowcaseGroupDefinition[] = [
  {
    id: "interactions",
    labelKey: "example.ui_showcase.group.interactions",
    labelFallback: "Interaction surfaces",
    descriptionKey: "example.ui_showcase.group.interactions_desc",
    descriptionFallback: "User-facing prompts and selection surfaces.",
  },
  {
    id: "feedback",
    labelKey: "example.ui_showcase.group.feedback",
    labelFallback: "Feedback states",
    descriptionKey: "example.ui_showcase.group.feedback_desc",
    descriptionFallback: "Execution, approval, and queued-work feedback.",
  },
  {
    id: "configuration",
    labelKey: "example.ui_showcase.group.configuration",
    labelFallback: "Configuration panels",
    descriptionKey: "example.ui_showcase.group.configuration_desc",
    descriptionFallback: "Model, tool, skill, and context configuration.",
  },
]

export const UI_DESIGN_SHOWCASE_DEMOS: UIShowcaseDemoDefinition[] = [
  {
    id: "plan",
    groupId: "interactions",
    labelKey: "example.components.plan_approval",
    labelFallback: "Plan approval",
    descriptionKey: "example.components.plan_approval_desc",
    descriptionFallback: "Approval flow",
    stateLabels: ["pending", "approved", "rejected"],
    interactive: true,
  },
  {
    id: "question",
    groupId: "interactions",
    labelKey: "example.components.question_input",
    labelFallback: "Question input",
    descriptionKey: "example.components.question_input_desc",
    descriptionFallback: "User prompt",
    stateLabels: ["unanswered", "partial", "submitted"],
    interactive: true,
  },
  {
    id: "emoji",
    groupId: "interactions",
    labelKey: "example.components.emoji_picker",
    labelFallback: "Emoji picker",
    descriptionKey: "example.components.emoji_picker_desc",
    descriptionFallback: "Reaction grid",
    stateLabels: ["idle", "hover", "selected"],
    interactive: true,
  },
  {
    id: "exec",
    groupId: "feedback",
    labelKey: "example.components.exec_approval",
    labelFallback: "Exec approval",
    descriptionKey: "example.components.exec_approval_desc",
    descriptionFallback: "Permission gate",
    stateLabels: ["allow once", "allow always", "reject"],
    interactive: true,
  },
  {
    id: "queue",
    groupId: "feedback",
    labelKey: "example.components.command_queue",
    labelFallback: "Command queue",
    descriptionKey: "example.components.command_queue_desc",
    descriptionFallback: "{{count}} queued",
    stateLabels: ["queued", "paused", "empty"],
    interactive: true,
  },
  {
    id: "tool-execution",
    groupId: "feedback",
    labelKey: "example.sections.toolExecution",
    labelFallback: "ToolExecutionItem (4 states)",
    descriptionKey: "example.ui_showcase.tool_execution_desc",
    descriptionFallback: "Queued, executing, success, and error rows.",
    stateLabels: ["queued", "executing", "success", "error"],
    interactive: false,
  },
  {
    id: "model-icons",
    groupId: "configuration",
    labelKey: "example.sections.modelIcons",
    labelFallback: "Model Icons",
    descriptionKey: "example.ui_showcase.model_icons_desc",
    descriptionFallback: "Brand icon treatments for supported model families.",
    stateLabels: ["mono", "color", "compact"],
    interactive: false,
  },
  {
    id: "config-panels",
    groupId: "configuration",
    labelKey: "example.sections.configPanels",
    labelFallback: "Config Panels",
    descriptionKey: "example.ui_showcase.config_panels_desc",
    descriptionFallback: "Tools, skills, and context panels.",
    stateLabels: ["collapsed", "expanded", "selected"],
    interactive: false,
  },
]
