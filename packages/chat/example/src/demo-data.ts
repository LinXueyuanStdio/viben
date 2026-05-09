import type {
  AgentMessage,
  TaskPlan,
  PendingQuestion,
  SlashCommand,
  ToolConfig,
  SkillConfig,
  ContextTokenBreakdown,
} from "@viben/chat"
import type { AgentOption, ModelOption, ExecutorOption } from "@viben/chat"

// ============================================================================
// Demo Messages - simulates a full agent conversation
// ============================================================================

export const demoMessages: AgentMessage[] = [
  {
    id: "msg-1",
    type: "user",
    content: "Help me create a React component that displays a list of users with search functionality.",
  },
  {
    id: "msg-2",
    type: "thinking",
    content: "The user wants a React component with user list and search. I should first check the existing codebase structure, then implement the component with proper TypeScript types.",
  },
  {
    id: "msg-3",
    type: "text",
    content: "I'll create a `UserList` component with search functionality. Let me first check the project structure to understand the conventions being used.",
  },
  {
    id: "msg-4",
    type: "tool_use",
    name: "Glob",
    toolUseId: "tool-1",
    input: { pattern: "src/components/**/*.tsx" },
  },
  {
    id: "msg-4r",
    type: "tool_result",
    toolUseId: "tool-1",
    output: "src/components/Button.tsx\nsrc/components/Card.tsx\nsrc/components/Layout.tsx",
  },
  {
    id: "msg-5",
    type: "tool_use",
    name: "Read",
    toolUseId: "tool-2",
    input: { file_path: "src/components/Card.tsx" },
  },
  {
    id: "msg-5r",
    type: "tool_result",
    toolUseId: "tool-2",
    output: 'import React from "react";\n\nexport function Card({ children, className }: { children: React.ReactNode; className?: string }) {\n  return <div className={`rounded-xl border p-4 ${className}`}>{children}</div>;\n}',
  },
  {
    id: "msg-6",
    type: "text",
    content: "I can see the project uses functional components with TypeScript. Now I'll create the `UserList` component following the same patterns.",
  },
  {
    id: "msg-7",
    type: "tool_use",
    name: "Write",
    toolUseId: "tool-3",
    input: {
      file_path: "src/components/UserList.tsx",
      content: 'import { useState, useMemo } from "react";\nimport { Card } from "./Card";\n\ninterface User {\n  id: string;\n  name: string;\n  email: string;\n  avatar?: string;\n}\n\ninterface UserListProps {\n  users: User[];\n  onSelect?: (user: User) => void;\n}\n\nexport function UserList({ users, onSelect }: UserListProps) {\n  const [search, setSearch] = useState("");\n\n  const filtered = useMemo(\n    () => users.filter(u =>\n      u.name.toLowerCase().includes(search.toLowerCase()) ||\n      u.email.toLowerCase().includes(search.toLowerCase())\n    ),\n    [users, search]\n  );\n\n  return (\n    <div className="space-y-3">\n      <input\n        type="text"\n        placeholder="Search users..."\n        value={search}\n        onChange={(e) => setSearch(e.target.value)}\n        className="w-full rounded-lg border px-3 py-2"\n      />\n      <div className="space-y-2">\n        {filtered.map(user => (\n          <Card key={user.id} className="cursor-pointer hover:bg-accent"\n            onClick={() => onSelect?.(user)}>\n            <div className="flex items-center gap-3">\n              <div className="h-8 w-8 rounded-full bg-primary/20" />\n              <div>\n                <p className="font-medium">{user.name}</p>\n                <p className="text-sm text-muted-foreground">{user.email}</p>\n              </div>\n            </div>\n          </Card>\n        ))}\n      </div>\n    </div>\n  );\n}',
    },
  },
  {
    id: "msg-7r",
    type: "tool_result",
    toolUseId: "tool-3",
    output: "File written successfully.",
  },
  {
    id: "msg-8",
    type: "text",
    content: "I've created the `UserList` component at `src/components/UserList.tsx`. Here's what it includes:\n\n- **TypeScript interfaces** for `User` and `UserListProps`\n- **Search functionality** that filters by both name and email (case-insensitive)\n- **Memoized filtering** with `useMemo` for performance\n- **Click handling** via `onSelect` callback\n- **Consistent styling** using the existing `Card` component pattern\n\nWould you like me to add any additional features like pagination, sorting, or loading states?",
  },
]

// ============================================================================
// Demo Plan
// ============================================================================

export const demoPlan: TaskPlan = {
  goal: "Create a user management dashboard with CRUD operations",
  steps: [
    { id: "s1", description: "Set up project structure and dependencies", status: "completed" },
    { id: "s2", description: "Create User model and TypeScript interfaces", status: "completed" },
    { id: "s3", description: "Implement UserList component with search", status: "in_progress" },
    { id: "s4", description: "Add create/edit user form component", status: "pending" },
    { id: "s5", description: "Connect to API endpoints", status: "pending" },
    { id: "s6", description: "Add unit tests", status: "pending" },
  ],
  notes: "Using React Query for data fetching, Zod for validation",
}

// ============================================================================
// Demo Questions
// ============================================================================

export const demoQuestions: PendingQuestion = {
  id: "q-1",
  questions: [
    {
      header: "State Management",
      question: "Which state management approach would you prefer for this project?",
      options: [
        { label: "React Context + useReducer", description: "Built-in, no extra dependencies" },
        { label: "Zustand", description: "Lightweight, simple API" },
        { label: "Redux Toolkit", description: "Full-featured, great DevTools" },
        { label: "Jotai", description: "Atomic state management" },
      ],
      multiSelect: false,
    },
    {
      header: "Features",
      question: "Which additional features should be included?",
      options: [
        { label: "Dark mode", description: "Theme switching support" },
        { label: "Pagination", description: "Page-based navigation" },
        { label: "Export to CSV", description: "Data export capability" },
        { label: "Real-time updates", description: "WebSocket integration" },
      ],
      multiSelect: true,
    },
  ],
}

// ============================================================================
// Demo Config Options
// ============================================================================

export const demoAgents: AgentOption[] = [
  { id: "coder", name: "Coder", description: "Full-stack development agent", model: "claude-opus-4-6" },
  { id: "reviewer", name: "Reviewer", description: "Code review specialist", model: "claude-sonnet-4-6" },
  { id: "planner", name: "Planner", description: "Architecture planning agent", model: "claude-opus-4-6" },
]

export const demoModels: ModelOption[] = [
  { id: "claude-opus-4-6", name: "Claude Opus 4.6", provider: "anthropic" },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", provider: "anthropic" },
  { id: "gpt-4o", name: "GPT-4o", provider: "openai" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "google" },
]

export const demoExecutors: ExecutorOption[] = [
  { id: "claude-code", name: "Claude Code", description: "Agentic coding with CLI" },
  { id: "cursor", name: "Cursor", description: "AI-powered IDE" },
]

export const demoTools: ToolConfig[] = [
  { id: "read", name: "Read", description: "Read file contents", enabled: true },
  { id: "write", name: "Write", description: "Write/create files", enabled: true },
  { id: "edit", name: "Edit", description: "Edit existing files", enabled: true },
  { id: "bash", name: "Bash", description: "Execute shell commands", enabled: true },
  { id: "glob", name: "Glob", description: "Find files by pattern", enabled: true },
  { id: "grep", name: "Grep", description: "Search file contents", enabled: true },
  { id: "web-search", name: "WebSearch", description: "Search the web", enabled: false },
  { id: "web-fetch", name: "WebFetch", description: "Fetch URL content", enabled: false },
]

export const demoSkills: SkillConfig[] = [
  { id: "tdd", name: "TDD", description: "Test-driven development workflow", enabled: true },
  { id: "debugging", name: "Debugging", description: "Systematic debugging approach", enabled: true },
  { id: "refactoring", name: "Refactoring", description: "Code refactoring patterns", enabled: false },
]

export const demoSlashCommands: SlashCommand[] = [
  { id: "commit", name: "/commit", description: "Create a git commit" },
  { id: "review", name: "/review", description: "Review current changes" },
  { id: "test", name: "/test", description: "Run test suite" },
  { id: "plan", name: "/plan", description: "Create implementation plan" },
]

export const demoContextBreakdown: ContextTokenBreakdown = {
  assistantProfile: 1200,
  skillSettings: 800,
  historySummary: 2400,
  conversationMessages: 15600,
  totalContext: 200000,
}

// ============================================================================
// JSONL Session Parser (same as pages/session-player)
// ============================================================================

export function parseSessionJsonl(text: string): AgentMessage[] {
  const lines = text.trim().split("\n")
  const messages: AgentMessage[] = []
  const seenTool = new Set<string>()
  let msgCounter = 0

  for (const line of lines) {
    try {
      const obj = JSON.parse(line)
      const t = obj.type

      if (t === "user") {
        const content = obj.message?.content
        if (Array.isArray(content) && content.some((c: { type: string }) => c.type === "tool_result")) {
          for (const c of content) {
            if (c.type === "tool_result" && c.content) {
              const toolUseId = c.tool_use_id
              messages.push({
                id: `msg-${msgCounter++}`,
                type: "tool_result",
                toolUseId,
                output: typeof c.content === "string" ? c.content.slice(0, 500) : JSON.stringify(c.content).slice(0, 500),
                isError: c.is_error,
              })
            }
          }
          continue
        }
        let txt = ""
        if (typeof content === "string") txt = content
        else if (Array.isArray(content)) {
          for (const c of content) {
            if (c.type === "text") txt += c.text
          }
        }
        if (txt) {
          txt = txt.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "").trim()
          if (txt && !txt.startsWith("<local-command")) {
            messages.push({ id: `msg-${msgCounter++}`, type: "user", content: txt })
          }
        }
      } else if (t === "assistant") {
        const content = obj.message?.content
        if (!Array.isArray(content)) continue
        for (const c of content) {
          if (c.type === "thinking" && c.thinking) {
            messages.push({ id: `msg-${msgCounter++}`, type: "thinking", content: c.thinking.slice(0, 500) })
          } else if (c.type === "text" && c.text) {
            messages.push({ id: `msg-${msgCounter++}`, type: "text", content: c.text })
          } else if (c.type === "tool_use") {
            const tid = c.id
            if (tid && seenTool.has(tid)) continue
            seenTool.add(tid)
            messages.push({
              id: `msg-${msgCounter++}`,
              type: "tool_use",
              name: c.name,
              toolUseId: tid,
              input: c.input,
            })
          }
        }
      }
    } catch {
      // skip invalid lines
    }
  }
  return messages
}
