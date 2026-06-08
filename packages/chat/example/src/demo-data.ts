import type {
  AgentMessage,
  BackgroundTaskItem,
  TaskPlan,
  PendingQuestion,
  SlashCommand,
  ToolConfig,
  SkillConfig,
  ContextTokenBreakdown,
  CommandQueueItem,
  PendingExecApproval,
} from "@viben/chat"
import type { AgentOption, ModelOption, ExecutorOption } from "@viben/chat"
import { parseSessionJsonl as parseClaudeCodeSessionJsonl } from "./claudecode-log-provider"

// ============================================================================
// Demo Messages - simulates a full agent conversation with ALL features
// Includes: thinking, tool_use, tool_result, plan, ask_question, exec_approval,
//           command_queue, error, text, user messages, collapsed tool groups,
//           sub-agent tasks, web search, error recovery, result
// ============================================================================

const NOW = Date.now()

export const demoMessages: AgentMessage[] = [
  // ==========================================================================
  // Phase 1: User request & initial exploration
  // ==========================================================================
  {
    id: "msg-1",
    type: "user",
    content: "Help me build a full-stack user management dashboard with authentication, CRUD operations, and real-time updates.",
    timestamp: NOW - 600_000,
  },
  {
    id: "msg-2",
    type: "thinking",
    content: "This is a complex request. I need to first understand the project structure, then propose a plan before implementing. Let me explore the codebase and identify existing patterns, then ask the user about their preferences for state management and features.",
  },
  {
    id: "msg-3",
    type: "text",
    content: "I'll help you build a user management dashboard. Let me first explore the project to understand the existing patterns.",
  },
  {
    id: "msg-4",
    type: "tool_use",
    name: "Glob",
    toolUseId: "tool-1",
    input: { pattern: "src/**/*.{tsx,ts}" },
  },
  {
    id: "msg-4r",
    type: "tool_result",
    toolUseId: "tool-1",
    output: "src/App.tsx\nsrc/main.tsx\nsrc/components/Button.tsx\nsrc/components/Card.tsx\nsrc/components/Layout.tsx\nsrc/lib/api.ts\nsrc/lib/auth.ts\nsrc/hooks/useQuery.ts",
  },
  {
    id: "msg-5",
    type: "tool_use",
    name: "Read",
    toolUseId: "tool-2",
    input: { file_path: "src/lib/api.ts" },
  },
  {
    id: "msg-5r",
    type: "tool_result",
    toolUseId: "tool-2",
    output: 'import { createClient } from "@supabase/supabase-js";\n\nconst supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_KEY);\n\nexport { supabase };',
  },
  {
    id: "msg-6",
    type: "tool_use",
    name: "Read",
    toolUseId: "tool-3",
    input: { file_path: "package.json" },
  },
  {
    id: "msg-6r",
    type: "tool_result",
    toolUseId: "tool-3",
    output: '{\n  "dependencies": {\n    "react": "^19.0.0",\n    "@supabase/supabase-js": "^2.45.0",\n    "tailwindcss": "^4.0.0",\n    "zod": "^3.23.0"\n  }\n}',
  },

  // ==========================================================================
  // Phase 2: Ask user questions (triggers interactive QuestionInput)
  // ==========================================================================
  {
    id: "msg-7",
    type: "text",
    content: "I can see you're using Supabase, React 19, and Tailwind v4. Before I plan the implementation, I have a few questions about your preferences:",
  },
  {
    id: "msg-8",
    type: "ask_question",
    content: "Asking user for preferences",
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
          { label: "Real-time updates", description: "WebSocket/Supabase realtime" },
        ],
        multiSelect: true,
      },
    ],
  },

  // ==========================================================================
  // Phase 3: User answers, agent proposes plan (triggers PlanApproval)
  // ==========================================================================
  {
    id: "msg-9",
    type: "user",
    content: "I'll go with Zustand for state management. Include dark mode, pagination, and real-time updates.",
    timestamp: NOW - 540_000,
  },
  {
    id: "msg-10",
    type: "thinking",
    content: "Great, user chose Zustand + dark mode + pagination + real-time updates. Let me create a comprehensive plan using EnterPlanMode to get approval before coding.",
  },
  {
    id: "msg-11",
    type: "plan_mode",
    planModeAction: "enter",
    content: "Entering plan mode to design the implementation approach.",
  },
  {
    id: "msg-12",
    type: "plan",
    content: "Here's my proposed implementation plan:",
    plan: {
      goal: "Build a full-stack user management dashboard with authentication, CRUD, and real-time updates",
      steps: [
        { id: "s1", description: "Set up Zustand store with user state and actions", status: "pending" },
        { id: "s2", description: "Create authentication flow (login/signup/logout)", status: "pending" },
        { id: "s3", description: "Implement UserList component with search and pagination", status: "pending" },
        { id: "s4", description: "Add CreateUser and EditUser form components with Zod validation", status: "pending" },
        { id: "s5", description: "Wire up Supabase real-time subscriptions for live updates", status: "pending" },
        { id: "s6", description: "Add dark mode support with theme toggle", status: "pending" },
        { id: "s7", description: "Write unit tests for critical paths", status: "pending" },
      ],
      notes: "Using Zustand for state, Supabase for backend/realtime, Zod for validation, Tailwind v4 for styling",
    },
  },

  // ==========================================================================
  // Phase 4: Plan approved, start implementation
  // ==========================================================================
  {
    id: "msg-13",
    type: "user",
    content: "Looks good! Let's start with step 1.",
    timestamp: NOW - 480_000,
  },
  {
    id: "msg-14",
    type: "plan_mode",
    planModeAction: "exit",
    content: "Plan approved. Starting implementation.",
  },
  {
    id: "msg-15",
    type: "text",
    content: "Plan approved! Starting with step 1: Setting up the Zustand store.",
  },

  // ==========================================================================
  // Phase 5: Implementation with tool calls
  // ==========================================================================
  {
    id: "msg-16",
    type: "tool_use",
    name: "Bash",
    toolUseId: "tool-4",
    input: { command: "pnpm add zustand" },
  },
  {
    id: "msg-16a",
    type: "tool_result",
    toolUseId: "tool-4",
    output: "Added zustand@5.0.0",
  },
  {
    id: "msg-17",
    type: "tool_use",
    name: "Write",
    toolUseId: "tool-5",
    input: {
      file_path: "src/store/user-store.ts",
      content: 'import { create } from "zustand";\nimport { supabase } from "../lib/api";\n\ninterface User {\n  id: string;\n  name: string;\n  email: string;\n  role: "admin" | "user";\n  avatar_url?: string;\n  created_at: string;\n}\n\ninterface UserStore {\n  users: User[];\n  loading: boolean;\n  error: string | null;\n  fetchUsers: () => Promise<void>;\n  addUser: (user: Omit<User, "id" | "created_at">) => Promise<void>;\n  updateUser: (id: string, data: Partial<User>) => Promise<void>;\n  deleteUser: (id: string) => Promise<void>;\n}\n\nexport const useUserStore = create<UserStore>((set) => ({\n  users: [],\n  loading: false,\n  error: null,\n  fetchUsers: async () => {\n    set({ loading: true, error: null });\n    const { data, error } = await supabase.from("users").select("*");\n    set({ users: data || [], loading: false, error: error?.message || null });\n  },\n  addUser: async (user) => {\n    const { error } = await supabase.from("users").insert(user);\n    if (error) set({ error: error.message });\n  },\n  updateUser: async (id, data) => {\n    const { error } = await supabase.from("users").update(data).eq("id", id);\n    if (error) set({ error: error.message });\n  },\n  deleteUser: async (id) => {\n    const { error } = await supabase.from("users").delete().eq("id", id);\n    if (error) set({ error: error.message });\n  },\n}));',
    },
  },
  {
    id: "msg-17r",
    type: "tool_result",
    toolUseId: "tool-5",
    output: "File written successfully.",
  },
  {
    id: "msg-18",
    type: "text",
    content: "Zustand store is set up. Now let me create the UserList component with search and pagination. I need to install a few more packages first.",
  },

  // ==========================================================================
  // Phase 6: Dangerous command triggers exec approval
  // ==========================================================================
  {
    id: "msg-19",
    type: "tool_use",
    name: "Bash",
    toolUseId: "tool-6",
    input: { command: "rm -rf dist/ && pnpm build" },
  },
  {
    id: "msg-19a",
    type: "tool_result",
    toolUseId: "tool-6",
    output: "Build completed successfully.",
  },

  // --- Phase 7: Continue after approval, more tool calls ---
  {
    id: "msg-20",
    type: "tool_use",
    name: "Write",
    toolUseId: "tool-7",
    input: {
      file_path: "src/components/UserList.tsx",
      content: 'import { useState, useMemo, useEffect } from "react";\nimport { useUserStore } from "../store/user-store";\n\nexport function UserList() {\n  const { users, loading, fetchUsers } = useUserStore();\n  const [search, setSearch] = useState("");\n  const [page, setPage] = useState(1);\n  const perPage = 10;\n\n  useEffect(() => { fetchUsers(); }, [fetchUsers]);\n\n  const filtered = useMemo(\n    () => users.filter(u => u.name.toLowerCase().includes(search.toLowerCase())),\n    [users, search]\n  );\n  const paged = filtered.slice((page - 1) * perPage, page * perPage);\n  const totalPages = Math.ceil(filtered.length / perPage);\n\n  if (loading) return <div className="animate-pulse">Loading...</div>;\n\n  return (\n    <div className="space-y-4">\n      <input placeholder="Search users..." value={search}\n        onChange={e => setSearch(e.target.value)}\n        className="w-full rounded-lg border px-3 py-2" />\n      {paged.map(user => (\n        <div key={user.id} className="flex items-center gap-3 rounded-lg border p-3">\n          <div className="h-10 w-10 rounded-full bg-primary/20" />\n          <div className="flex-1">\n            <p className="font-medium">{user.name}</p>\n            <p className="text-sm text-muted-foreground">{user.email}</p>\n          </div>\n          <span className="text-xs bg-muted px-2 py-1 rounded">{user.role}</span>\n        </div>\n      ))}\n      <div className="flex justify-center gap-2">\n        <button disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Prev</button>\n        <span>{page}/{totalPages}</span>\n        <button disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>Next</button>\n      </div>\n    </div>\n  );\n}',
    },
  },
  {
    id: "msg-20r",
    type: "tool_result",
    toolUseId: "tool-7",
    output: "File written successfully.",
  },

  // ==========================================================================
  // Phase 8: Error scenario
  // ==========================================================================
  {
    id: "msg-21",
    type: "tool_use",
    name: "Bash",
    toolUseId: "tool-8",
    input: { command: "pnpm typecheck" },
  },
  {
    id: "msg-21r",
    type: "tool_result",
    toolUseId: "tool-8",
    output: "src/store/user-store.ts:15:3 - error TS2345: Argument of type '{ users: never[]; }' is not assignable.\nsrc/components/UserList.tsx:8:22 - error TS7006: Parameter 'u' implicitly has 'any' type.",
    isError: true,
  },
  {
    id: "msg-22",
    type: "thinking",
    content: "There are TypeScript errors. The users array needs proper typing and the filter callback needs explicit types. Let me fix these issues.",
  },
  {
    id: "msg-23",
    type: "text",
    content: "I see some TypeScript errors. Let me fix the type issues in both files.",
  },
  {
    id: "msg-24",
    type: "tool_use",
    name: "Edit",
    toolUseId: "tool-9",
    input: {
      file_path: "src/store/user-store.ts",
      old_string: "users: [],",
      new_string: "users: [] as User[],",
    },
  },
  {
    id: "msg-24r",
    type: "tool_result",
    toolUseId: "tool-9",
    output: "File edited successfully.",
  },

  // ==========================================================================
  // Phase 9: Running tests
  // ==========================================================================
  {
    id: "msg-25",
    type: "tool_use",
    name: "Bash",
    toolUseId: "tool-10",
    input: { command: "pnpm typecheck" },
  },
  {
    id: "msg-25r",
    type: "tool_result",
    toolUseId: "tool-10",
    output: "No errors found.",
  },
  {
    id: "msg-26",
    type: "text",
    content: "TypeScript errors are fixed. Here's a summary of what's been implemented so far:\n\n**Completed:**\n- Zustand store with full CRUD actions (`src/store/user-store.ts`)\n- UserList component with search + pagination (`src/components/UserList.tsx`)\n\n**Remaining:**\n- Create/Edit user forms with Zod validation\n- Supabase real-time subscriptions\n- Dark mode theme toggle\n- Unit tests\n\nShall I continue with the next step?",
  },

  // ==========================================================================
  // Phase 10: User sends more messages (simulating queue behavior)
  // ==========================================================================
  {
    id: "msg-27",
    type: "user",
    content: "Yes, continue with the forms. Also add the dark mode toggle while you're at it.",
    timestamp: NOW - 420_000,
  },
  {
    id: "msg-28",
    type: "thinking",
    content: "The user wants forms + dark mode. I'll implement both in parallel. Let me first add the dark mode since it's simpler, then the forms with Zod validation.",
  },
  {
    id: "msg-29",
    type: "tool_use",
    name: "Write",
    toolUseId: "tool-11",
    input: {
      file_path: "src/components/ThemeToggle.tsx",
      content: 'import { Sun, Moon } from "lucide-react";\nimport { useThemeStore } from "../store/theme-store";\n\nexport function ThemeToggle() {\n  const { dark, toggle } = useThemeStore();\n  return (\n    <button onClick={toggle} className="p-2 rounded-lg hover:bg-accent">\n      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}\n    </button>\n  );\n}',
    },
  },
  {
    id: "msg-29r",
    type: "tool_result",
    toolUseId: "tool-11",
    output: "File written successfully.",
  },
  {
    id: "msg-30",
    type: "tool_use",
    name: "Write",
    toolUseId: "tool-12",
    input: {
      file_path: "src/components/UserForm.tsx",
      content: 'import { useForm } from "react-hook-form";\nimport { zodResolver } from "@hookform/resolvers/zod";\nimport { z } from "zod";\n\nconst userSchema = z.object({\n  name: z.string().min(2, "Name must be at least 2 characters"),\n  email: z.string().email("Invalid email address"),\n  role: z.enum(["admin", "user"]),\n});\n\ntype UserFormData = z.infer<typeof userSchema>;\n\nexport function UserForm({ onSubmit, defaultValues }: {\n  onSubmit: (data: UserFormData) => void;\n  defaultValues?: Partial<UserFormData>;\n}) {\n  const { register, handleSubmit, formState: { errors } } = useForm<UserFormData>({\n    resolver: zodResolver(userSchema),\n    defaultValues,\n  });\n\n  return (\n    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">\n      <div>\n        <input {...register("name")} placeholder="Name" className="input" />\n        {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}\n      </div>\n      <div>\n        <input {...register("email")} placeholder="Email" className="input" />\n        {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}\n      </div>\n      <select {...register("role")} className="input">\n        <option value="user">User</option>\n        <option value="admin">Admin</option>\n      </select>\n      <button type="submit" className="btn-primary">Save</button>\n    </form>\n  );\n}',
    },
  },
  {
    id: "msg-30r",
    type: "tool_result",
    toolUseId: "tool-12",
    output: "File written successfully.",
  },
  {
    id: "msg-31",
    type: "text",
    content: "All major components are now implemented:\n\n1. **ThemeToggle** -- Dark/light mode switch using a Zustand theme store\n2. **UserForm** -- Create/edit form with Zod validation for name, email, and role\n3. **UserList** -- Search + pagination powered by Zustand user store\n4. **User Store** -- Full CRUD with Supabase integration\n\nNow let me wire up real-time subscriptions and review the full project.",
  },

  // ==========================================================================
  // Phase A: Collapsed Tool Groups (5+ consecutive Read/Glob/Grep calls)
  // These consecutive same-type tool calls trigger the auto-collapse feature
  // ==========================================================================
  {
    id: "msg-cg-0",
    type: "text",
    content: "Let me review all the existing components to make sure the real-time subscriptions integrate correctly.",
  },
  {
    id: "msg-cg-1",
    type: "tool_use",
    name: "Read",
    toolUseId: "tool-cg-1",
    input: { file_path: "src/components/UserList.tsx" },
  },
  {
    id: "msg-cg-1r",
    type: "tool_result",
    toolUseId: "tool-cg-1",
    output: '// UserList component\nimport { useState, useMemo, useEffect } from "react";\nimport { useUserStore } from "../store/user-store";\n\nexport function UserList() {\n  const { users, loading, fetchUsers } = useUserStore();\n  const [search, setSearch] = useState("");\n  // ... 45 lines ...',
  },
  {
    id: "msg-cg-2",
    type: "tool_use",
    name: "Read",
    toolUseId: "tool-cg-2",
    input: { file_path: "src/components/UserForm.tsx" },
  },
  {
    id: "msg-cg-2r",
    type: "tool_result",
    toolUseId: "tool-cg-2",
    output: '// UserForm component\nimport { useForm } from "react-hook-form";\nimport { zodResolver } from "@hookform/resolvers/zod";\nimport { z } from "zod";\n\nconst userSchema = z.object({\n  name: z.string().min(2),\n  // ... 38 lines ...',
  },
  {
    id: "msg-cg-3",
    type: "tool_use",
    name: "Read",
    toolUseId: "tool-cg-3",
    input: { file_path: "src/store/user-store.ts" },
  },
  {
    id: "msg-cg-3r",
    type: "tool_result",
    toolUseId: "tool-cg-3",
    output: 'import { create } from "zustand";\nimport { supabase } from "../lib/api";\n\ninterface User {\n  id: string;\n  name: string;\n  email: string;\n  role: "admin" | "user";\n  // ... 32 lines ...',
  },
  {
    id: "msg-cg-4",
    type: "tool_use",
    name: "Read",
    toolUseId: "tool-cg-4",
    input: { file_path: "src/components/ThemeToggle.tsx" },
  },
  {
    id: "msg-cg-4r",
    type: "tool_result",
    toolUseId: "tool-cg-4",
    output: 'import { Sun, Moon } from "lucide-react";\nimport { useThemeStore } from "../store/theme-store";\n\nexport function ThemeToggle() {\n  const { dark, toggle } = useThemeStore();\n  // ... 8 lines ...',
  },
  {
    id: "msg-cg-5",
    type: "tool_use",
    name: "Read",
    toolUseId: "tool-cg-5",
    input: { file_path: "src/lib/auth.ts" },
  },
  {
    id: "msg-cg-5r",
    type: "tool_result",
    toolUseId: "tool-cg-5",
    output: 'import { supabase } from "./api";\n\nexport async function signIn(email: string, password: string) {\n  const { data, error } = await supabase.auth.signInWithPassword({ email, password });\n  if (error) throw error;\n  return data;\n}\n\nexport async function signUp(email: string, password: string) {\n  const { data, error } = await supabase.auth.signUp({ email, password });\n  if (error) throw error;\n  return data;\n}',
  },
  // Now a run of consecutive Grep calls (triggers a second collapsed group)
  {
    id: "msg-cg-6",
    type: "tool_use",
    name: "Grep",
    toolUseId: "tool-cg-6",
    input: { pattern: "useEffect", path: "src/" },
  },
  {
    id: "msg-cg-6r",
    type: "tool_result",
    toolUseId: "tool-cg-6",
    output: "src/components/UserList.tsx:1:import { useState, useMemo, useEffect } from \"react\";\nsrc/components/UserList.tsx:9:  useEffect(() => { fetchUsers(); }, [fetchUsers]);\nsrc/App.tsx:3:import { useEffect } from \"react\";",
  },
  {
    id: "msg-cg-7",
    type: "tool_use",
    name: "Grep",
    toolUseId: "tool-cg-7",
    input: { pattern: "supabase\\.from", path: "src/" },
  },
  {
    id: "msg-cg-7r",
    type: "tool_result",
    toolUseId: "tool-cg-7",
    output: "src/store/user-store.ts:22:    const { data, error } = await supabase.from(\"users\").select(\"*\");\nsrc/store/user-store.ts:26:    const { error } = await supabase.from(\"users\").insert(user);\nsrc/store/user-store.ts:30:    const { error } = await supabase.from(\"users\").update(data).eq(\"id\", id);\nsrc/store/user-store.ts:34:    const { error } = await supabase.from(\"users\").delete().eq(\"id\", id);",
  },
  {
    id: "msg-cg-8",
    type: "tool_use",
    name: "Grep",
    toolUseId: "tool-cg-8",
    input: { pattern: "realtime|subscribe|channel", path: "src/" },
  },
  {
    id: "msg-cg-8r",
    type: "tool_result",
    toolUseId: "tool-cg-8",
    output: "(no matches found)",
  },

  // ==========================================================================
  // Phase B: Multiple ExecApproval scenarios (dangerous commands)
  // ==========================================================================
  {
    id: "msg-ea-0",
    type: "text",
    content: "Good, no real-time subscriptions exist yet. Before I add them, let me clean up the build artifacts and prepare the project.",
  },
  // Approval scenario 1: file deletion
  {
    id: "msg-ea-1",
    type: "tool_use",
    name: "Bash",
    toolUseId: "tool-ea-1",
    input: { command: "rm -rf dist/ && rm -rf .cache/" },
  },
  {
    id: "msg-ea-1r",
    type: "tool_result",
    toolUseId: "tool-ea-1",
    output: "Directories removed.",
  },
  // Approval scenario 2: database migration (destructive)
  {
    id: "msg-ea-2",
    type: "tool_use",
    name: "Bash",
    toolUseId: "tool-ea-2",
    input: { command: "# Drop and recreate database tables\npnpm db:push --force" },
  },
  {
    id: "msg-ea-2r",
    type: "tool_result",
    toolUseId: "tool-ea-2",
    output: "Database schema pushed successfully.\n  + users (created)\n  + sessions (created)\n  + audit_log (created)",
  },
  // Approval scenario 3: git force push
  {
    id: "msg-ea-3",
    type: "tool_use",
    name: "Bash",
    toolUseId: "tool-ea-3",
    input: { command: "git push --force origin main" },
  },
  {
    id: "msg-ea-3r",
    type: "tool_result",
    toolUseId: "tool-ea-3",
    output: "To github.com:user/project.git\n + abc1234...def5678 main -> main (forced update)",
  },

  // ==========================================================================
  // Phase C: Edit/Write operations (file creation & modification)
  // ==========================================================================
  {
    id: "msg-w-0",
    type: "thinking",
    content: "Now I need to create the real-time subscription hook and the user store update. Let me also create an auth store for managing login state.",
  },
  // Write new file: user store
  {
    id: "msg-w-1",
    type: "tool_use",
    name: "Write",
    toolUseId: "tool-w-1",
    input: {
      file_path: "src/stores/user-store.ts",
      content: "import { create } from 'zustand';\n\ninterface UserStore {\n  users: User[];\n  loading: boolean;\n  fetchUsers: () => Promise<void>;\n}\n\nexport const useUserStore = create<UserStore>((set) => ({\n  users: [],\n  loading: false,\n  fetchUsers: async () => {\n    set({ loading: true });\n    const response = await fetch('/api/users');\n    const users = await response.json();\n    set({ users, loading: false });\n  },\n}));",
    },
  },
  {
    id: "msg-w-1r",
    type: "tool_result",
    toolUseId: "tool-w-1",
    output: "File created successfully",
  },
  // Write new file: realtime hook
  {
    id: "msg-w-2",
    type: "tool_use",
    name: "Write",
    toolUseId: "tool-w-2",
    input: {
      file_path: "src/hooks/useRealtimeUsers.ts",
      content: 'import { useEffect } from "react";\nimport { supabase } from "../lib/api";\nimport { useUserStore } from "../store/user-store";\n\nexport function useRealtimeUsers() {\n  const fetchUsers = useUserStore((s) => s.fetchUsers);\n\n  useEffect(() => {\n    const channel = supabase\n      .channel("users-changes")\n      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, () => {\n        fetchUsers();\n      })\n      .subscribe();\n\n    return () => {\n      supabase.removeChannel(channel);\n    };\n  }, [fetchUsers]);\n}',
    },
  },
  {
    id: "msg-w-2r",
    type: "tool_result",
    toolUseId: "tool-w-2",
    output: "File created successfully",
  },
  // Edit existing file: add realtime hook to App.tsx
  {
    id: "msg-e-1",
    type: "tool_use",
    name: "Edit",
    toolUseId: "tool-e-1",
    input: {
      file_path: "src/App.tsx",
      old_string: "import { BrowserRouter }",
      new_string: "import { BrowserRouter, Routes, Route }",
    },
  },
  {
    id: "msg-e-1r",
    type: "tool_result",
    toolUseId: "tool-e-1",
    output: "File modified successfully",
  },
  // Edit existing file: wire up realtime in UserList
  {
    id: "msg-e-2",
    type: "tool_use",
    name: "Edit",
    toolUseId: "tool-e-2",
    input: {
      file_path: "src/components/UserList.tsx",
      old_string: 'import { useUserStore } from "../store/user-store";',
      new_string: 'import { useUserStore } from "../store/user-store";\nimport { useRealtimeUsers } from "../hooks/useRealtimeUsers";',
    },
  },
  {
    id: "msg-e-2r",
    type: "tool_result",
    toolUseId: "tool-e-2",
    output: "File modified successfully",
  },
  {
    id: "msg-e-3",
    type: "tool_use",
    name: "Edit",
    toolUseId: "tool-e-3",
    input: {
      file_path: "src/components/UserList.tsx",
      old_string: "useEffect(() => { fetchUsers(); }, [fetchUsers]);",
      new_string: "useRealtimeUsers();\n  useEffect(() => { fetchUsers(); }, [fetchUsers]);",
    },
  },
  {
    id: "msg-e-3r",
    type: "tool_result",
    toolUseId: "tool-e-3",
    output: "File modified successfully",
  },

  // ==========================================================================
  // Phase D: Error recovery flow
  // ==========================================================================
  {
    id: "msg-err-0",
    type: "text",
    content: "Real-time subscriptions are wired up. Let me verify everything compiles correctly.",
  },
  // Bash that fails
  {
    id: "msg-err-1",
    type: "tool_use",
    name: "Bash",
    toolUseId: "tool-err-1",
    input: { command: "pnpm typecheck" },
  },
  {
    id: "msg-err-1r",
    type: "tool_result",
    toolUseId: "tool-err-1",
    output: "src/stores/user-store.ts(15,3): error TS2345: Argument of type '{ users: never[]; }' is not assignable to parameter of type 'UserStore'.\nsrc/components/UserList.tsx(8,5): error TS7006: Parameter 'user' implicitly has an 'any' type.\n\nFound 2 errors.",
    isError: true,
  },
  // Agent thinks and fixes
  {
    id: "msg-err-2",
    type: "thinking",
    content: "The typecheck failed with 2 errors. I need to add proper types to the store and component. The User type is missing from the new user-store file, and the UserList filter callback needs explicit typing.",
  },
  {
    id: "msg-err-3",
    type: "tool_use",
    name: "Edit",
    toolUseId: "tool-err-2",
    input: {
      file_path: "src/stores/user-store.ts",
      old_string: "users: [],",
      new_string: "users: [] as User[],",
    },
  },
  {
    id: "msg-err-3r",
    type: "tool_result",
    toolUseId: "tool-err-2",
    output: "File modified successfully",
  },
  {
    id: "msg-err-4",
    type: "tool_use",
    name: "Edit",
    toolUseId: "tool-err-3",
    input: {
      file_path: "src/components/UserList.tsx",
      old_string: "() => users.filter(u =>",
      new_string: "() => users.filter((u: User) =>",
    },
  },
  {
    id: "msg-err-4r",
    type: "tool_result",
    toolUseId: "tool-err-3",
    output: "File modified successfully",
  },
  // Re-run typecheck: passes
  {
    id: "msg-err-5",
    type: "tool_use",
    name: "Bash",
    toolUseId: "tool-err-4",
    input: { command: "pnpm typecheck" },
  },
  {
    id: "msg-err-5r",
    type: "tool_result",
    toolUseId: "tool-err-4",
    output: "TypeScript: 0 errors found.",
  },
  {
    id: "msg-err-6",
    type: "text",
    content: "All type errors are fixed. The project compiles cleanly now.",
  },

  // ==========================================================================
  // Phase E: Sub-agent / Task tool
  // ==========================================================================
  {
    id: "msg-task-0",
    type: "user",
    content: "Great, now please write unit tests for the user store and components.",
    timestamp: NOW - 300_000,
  },
  {
    id: "msg-task-1",
    type: "thinking",
    content: "The user wants unit tests. I'll delegate this to a test-runner sub-agent since it's a self-contained task that can run in parallel.",
  },
  {
    id: "msg-task-2",
    type: "tool_use",
    name: "Task",
    toolUseId: "tool-task-1",
    input: {
      description: "Write unit tests for user-store and UserList component",
      prompt: "Write comprehensive unit tests for:\n1. src/stores/user-store.ts - test all CRUD operations, loading states, error handling\n2. src/components/UserList.tsx - test rendering, search filtering, pagination\n\nUse vitest + @testing-library/react. Ensure full coverage of edge cases.",
    },
    subagentId: "sub-test-1",
  },
  {
    id: "msg-task-2r",
    type: "tool_result",
    toolUseId: "tool-task-1",
    output: "Sub-agent completed successfully.\n\nFiles created:\n  - src/__tests__/user-store.test.ts (8 tests)\n  - src/__tests__/UserList.test.tsx (4 tests)\n\nResults: 12 passing, 0 failing.\n\nCoverage:\n  user-store.ts: 94% statements, 88% branches\n  UserList.tsx: 91% statements, 85% branches",
  },
  {
    id: "msg-task-3",
    type: "text",
    content: "The test sub-agent has created comprehensive tests:\n\n- **user-store.test.ts** -- 8 tests covering CRUD, loading states, and error handling\n- **UserList.test.tsx** -- 4 tests covering rendering, search, and pagination\n\nAll 12 tests pass with good coverage.",
  },

  // ==========================================================================
  // Phase F: Web search/fetch
  // ==========================================================================
  {
    id: "msg-web-0",
    type: "thinking",
    content: "Let me check if there are any known issues with Zustand v5 and Supabase realtime that I should be aware of before finalizing.",
  },
  {
    id: "msg-web-1",
    type: "tool_use",
    name: "WebSearch",
    toolUseId: "tool-web-1",
    input: { query: "zustand v5 supabase realtime subscription best practices 2026" },
  },
  {
    id: "msg-web-1r",
    type: "tool_result",
    toolUseId: "tool-web-1",
    output: "1. Zustand v5 Migration Guide - docs.pmnd.rs/zustand/migrations/v5\n   \"Key change: create() no longer accepts generic. Use createStore() for type-safe stores.\"\n\n2. Supabase Realtime + React Best Practices - supabase.com/docs/guides/realtime\n   \"Always clean up channel subscriptions in useEffect cleanup.\"\n\n3. Zustand 5: Breaking Changes - github.com/pmndrs/zustand/releases/tag/v5.0.0\n   \"Removed: devtools middleware default import. Use { devtools } named import.\"\n\n4. Full-Stack React Dashboard Tutorial 2026 - dev.to/dashboard-guide\n   \"Combining Zustand + Supabase Realtime for live dashboards.\"",
  },
  {
    id: "msg-web-2",
    type: "tool_use",
    name: "WebFetch",
    toolUseId: "tool-web-2",
    input: { url: "https://docs.pmnd.rs/zustand/migrations/v5" },
  },
  {
    id: "msg-web-2r",
    type: "tool_result",
    toolUseId: "tool-web-2",
    output: "# Zustand v5 Migration Guide\n\n## Breaking Changes\n\n1. `create()` generic syntax changed:\n   ```ts\n   // Before (v4)\n   const useStore = create<State>()(/* ... */)\n   // After (v5)\n   const useStore = create<State>(/* ... */)\n   ```\n\n2. `devtools` middleware:\n   ```ts\n   // Before\n   import create from 'zustand/devtools'\n   // After\n   import { devtools } from 'zustand/middleware'\n   ```\n\n3. Subscription selectors are now shallow by default.\n\n## Supabase Integration Tips\n- Use `immer` middleware for complex state mutations\n- Clean up realtime channels in useEffect return",
  },
  {
    id: "msg-web-3",
    type: "text",
    content: "I've reviewed the latest Zustand v5 migration guide. Our implementation already follows the correct patterns. The realtime hook properly cleans up subscriptions in the useEffect cleanup function.",
  },

  // ==========================================================================
  // Phase G: Final success run
  // ==========================================================================
  {
    id: "msg-final-0",
    type: "text",
    content: "Let me do a final verification to make sure everything builds and tests pass.",
  },
  {
    id: "msg-final-1",
    type: "tool_use",
    name: "Bash",
    toolUseId: "tool-final-1",
    input: { command: "pnpm typecheck && pnpm test" },
  },
  {
    id: "msg-final-1r",
    type: "tool_result",
    toolUseId: "tool-final-1",
    output: "TypeScript: 0 errors\n\n PASS  src/__tests__/user-store.test.ts (8 tests)\n PASS  src/__tests__/UserList.test.tsx (4 tests)\n\nTest Suites: 2 passed, 2 total\nTests:       12 passed, 12 total\nSnapshots:   0 total\nTime:        3.412s",
  },
  {
    id: "msg-final-2",
    type: "tool_use",
    name: "Bash",
    toolUseId: "tool-final-2",
    input: { command: "pnpm build" },
  },
  {
    id: "msg-final-2r",
    type: "tool_result",
    toolUseId: "tool-final-2",
    output: "vite v6.0.0 building for production...\n\n  dist/index.html                  0.45 kB | gzip: 0.29 kB\n  dist/assets/index-abc123.css    12.34 kB | gzip:  3.21 kB\n  dist/assets/index-def456.js     89.67 kB | gzip: 28.45 kB\n\nBuild completed in 2.1s.",
  },
  {
    id: "msg-final-3",
    type: "result",
    content: "I've implemented the full-stack user management dashboard with:\n\n1. **Authentication** -- Login/signup with Supabase Auth (`src/lib/auth.ts`)\n2. **User Store** -- Zustand state management with typed CRUD operations (`src/store/user-store.ts`)\n3. **CRUD Operations** -- Full user table with create, edit, and delete via forms (`src/components/UserForm.tsx`, `src/components/UserList.tsx`)\n4. **Real-time Updates** -- Supabase realtime subscriptions with automatic refresh (`src/hooks/useRealtimeUsers.ts`)\n5. **Dark Mode** -- Theme toggle with Zustand theme store (`src/components/ThemeToggle.tsx`)\n6. **Tests** -- 12 unit tests covering store logic and component rendering\n\nAll TypeScript checks pass, all tests are green, and the production build succeeds.",
    timestamp: NOW - 120_000,
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
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", provider: "anthropic" },
  { id: "gpt-4o", name: "GPT-4o", provider: "openai" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai" },
  { id: "o1", name: "o1", provider: "openai" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "google" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "google" },
]

/** Demo providers for TripleSelector */
export interface DemoProvider {
  id: string
  name: string
  type: string
}

export const demoProviders: DemoProvider[] = [
  { id: "anthropic", name: "Anthropic", type: "anthropic" },
  { id: "openai", name: "OpenAI", type: "openai" },
  { id: "google", name: "Google AI", type: "google" },
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
  { name: "commit", description: "Create a git commit", input: null },
  { name: "review", description: "Review current changes", input: null },
  { name: "test", description: "Run test suite", input: null },
  { name: "plan", description: "Create implementation plan", input: null },
]

export const demoContextBreakdown: ContextTokenBreakdown = {
  assistantProfile: 1200,
  skillSettings: 800,
  historySummary: 2400,
  conversationMessages: 15600,
  totalContext: 200000,
}

// ============================================================================
// Demo Command Queue Items
// ============================================================================

export const demoCommandQueueItems: CommandQueueItem[] = [
  { id: "cmd-1", content: "Run the test suite for the auth module", createdAt: Date.now() - 5000 },
  { id: "cmd-2", content: "Fix the failing TypeScript compilation errors", attachments: [{ id: "att-1", type: "file", name: "src/auth/login.ts" }, { id: "att-2", type: "file", name: "src/auth/types.ts" }], createdAt: Date.now() - 3000 },
  { id: "cmd-3", content: "Update the README with the new API endpoints", createdAt: Date.now() - 1000 },
]

export const demoTodoListMessages: AgentMessage[] = [
  {
    id: "todo-create-1",
    type: "tool_use",
    name: "TaskCreate",
    toolUseId: "todo-create-1",
    input: { id: "todo-1", subject: "Map TaskCreate and TaskUpdate inputs", status: "completed" },
  },
  {
    id: "todo-create-2",
    type: "tool_use",
    name: "TaskCreate",
    toolUseId: "todo-create-2",
    input: { id: "todo-2", subject: "Render collapsible task states", status: "pending" },
  },
  {
    id: "todo-update-2",
    type: "tool_use",
    name: "TaskUpdate",
    toolUseId: "todo-update-2",
    input: { id: "todo-2", status: "in_progress" },
  },
  {
    id: "todo-list-snapshot",
    type: "tool_use",
    name: "TodoList",
    toolUseId: "todo-list-snapshot",
    input: {
      todos: [
        { id: "todo-1", content: "Map TaskCreate and TaskUpdate inputs", status: "completed" },
        { id: "todo-2", content: "Render collapsible task states", status: "in_progress" },
        { id: "todo-3", content: "Document package exports", status: "pending" },
      ],
    },
  },
]

export const demoBackgroundTaskItems: BackgroundTaskItem[] = [
  {
    id: "bg-cron-1",
    kind: "cron",
    description: "Refresh provider catalog",
    status: "running",
    elapsedMs: 125000,
    usage: { inputTokens: 1200, outputTokens: 240, costUsd: 0.034 },
    details: "Scheduled refresh is checking model metadata and cached provider manifests.",
  },
  {
    id: "bg-agent-1",
    kind: "agent",
    description: "Audit chat UI components",
    status: "running",
    elapsedMs: 42000,
    usageLabel: "3 tools",
    details: "A delegated agent is reviewing component states and accessibility labels.",
    messages: [
      { id: "bg-agent-msg-1", type: "text", content: "Checking chat component contracts." },
      { id: "bg-agent-msg-2", type: "tool_use", name: "Grep", toolUseId: "bg-agent-tool-1", input: { pattern: "BackgroundTaskList" } },
    ],
  },
  {
    id: "bg-bash-1",
    kind: "bash",
    description: "pnpm --filter @viben/chat test",
    status: "running",
    elapsedMs: 9000,
    usageLabel: "1 command",
  },
]

// ============================================================================
// Demo Exec Approval (singular - original)
// ============================================================================

export const demoExecApproval: PendingExecApproval = {
  id: "approval-1",
  tool_call: {
    title: "Execute shell command",
    kind: "execute",
    command: "rm -rf node_modules && pnpm install",
    cwd: "/Users/dev/project",
  },
  options: [
    { id: "allow_once", label: "Allow" },
    { id: "allow_always", label: "Always" },
    { id: "reject", label: "Reject" },
  ],
}

// ============================================================================
// Demo Exec Approvals (plural - multiple variants for sidebar demo)
// ============================================================================

export const demoExecApprovals: PendingExecApproval[] = [
  {
    id: "approval-read",
    tool_call: {
      title: "Read sensitive file",
      kind: "read",
      command: "cat ~/.ssh/id_rsa",
      cwd: "/Users/dev",
    },
    options: [
      { id: "allow_once", label: "Allow" },
      { id: "allow_always", label: "Always" },
      { id: "reject", label: "Reject" },
    ],
  },
  {
    id: "approval-edit",
    tool_call: {
      title: "Edit configuration",
      kind: "edit",
      command: "Modify .env.production -- set DATABASE_URL=postgres://prod:secret@db.example.com/main",
      cwd: "/Users/dev/project",
    },
    options: [
      { id: "allow_once", label: "Allow" },
      { id: "allow_always", label: "Always" },
      { id: "reject", label: "Reject" },
    ],
  },
  {
    id: "approval-execute",
    tool_call: {
      title: "Run deployment",
      kind: "execute",
      command: "docker compose -f docker-compose.prod.yml up -d --build",
      cwd: "/Users/dev/project",
    },
    options: [
      { id: "allow_once", label: "Allow" },
      { id: "allow_always", label: "Always" },
      { id: "reject", label: "Reject" },
    ],
  },
  {
    id: "approval-force-push",
    tool_call: {
      title: "Force push to remote",
      kind: "execute",
      command: "git push --force origin main",
      cwd: "/Users/dev/project",
    },
    options: [
      { id: "allow_once", label: "Allow" },
      { id: "allow_always", label: "Always" },
      { id: "reject", label: "Reject" },
    ],
  },
  {
    id: "approval-db-drop",
    tool_call: {
      title: "Reset database",
      kind: "execute",
      command: "pnpm db:push --force --accept-data-loss",
      cwd: "/Users/dev/project",
    },
    options: [
      { id: "allow_once", label: "Allow" },
      { id: "allow_always", label: "Always" },
      { id: "reject", label: "Reject" },
    ],
  },
]

// ============================================================================
// JSONL Session Parser (same as pages/session-player)
// ============================================================================

export function parseSessionJsonl(text: string): AgentMessage[] {
  return parseClaudeCodeSessionJsonl(text)
}

// ============================================================================
// Session Folder Parser (with sub-agent support)
// ============================================================================

interface SubagentMeta {
  agentType?: string
  description?: string
}

/**
 * Extract the toolUseId → agentId mapping from progress entries in the main session.
 * Progress entries have: { type: "progress", data: { agentId: "..." }, parentToolUseID: "..." }
 */
function extractAgentMapping(text: string): Map<string, string> {
  const mapping = new Map<string, string>() // parentToolUseID → agentId
  const lines = text.trim().split("\n")
  for (const line of lines) {
    try {
      const obj = JSON.parse(line)
      if (obj.type === "progress" && obj.parentToolUseID && obj.data?.agentId) {
        // First occurrence wins (all progress entries for the same agent have the same mapping)
        if (!mapping.has(obj.parentToolUseID)) {
          mapping.set(obj.parentToolUseID, obj.data.agentId)
        }
      }
    } catch {
      // skip
    }
  }
  return mapping
}

/**
 * Parse a session folder (loaded via folder picker or multi-file input).
 * Handles the Claude Code session structure:
 *   SESSION_ID.jsonl (main session)
 *   SESSION_ID/subagents/agent-AGENT_ID.jsonl (sub-agent sessions)
 *   SESSION_ID/subagents/agent-AGENT_ID.meta.json (sub-agent metadata)
 */
export async function parseSessionFolder(files: File[]): Promise<{
  messages: AgentMessage[]
  sessionName: string
  subagentCount: number
}> {
  // Classify files by role
  let mainSessionFile: File | null = null
  const subagentJsonls = new Map<string, File>() // agentId → file
  const subagentMetas = new Map<string, File>()  // agentId → file

  for (const file of files) {
    const path = file.webkitRelativePath || file.name
    const parts = path.split("/")

    // Main session: either root-level .jsonl or the only .jsonl not in subagents/
    if (path.endsWith(".jsonl") && !parts.includes("subagents")) {
      // Prefer the largest .jsonl at root level as main session
      if (!mainSessionFile || file.size > mainSessionFile.size) {
        mainSessionFile = file
      }
    }

    // Sub-agent files: .../subagents/agent-AGENTID.jsonl or .meta.json
    if (parts.includes("subagents")) {
      const fileName = parts[parts.length - 1]
      const match = fileName.match(/^agent-([a-f0-9]+)\.(jsonl|meta\.json)$/)
      if (match) {
        const agentId = match[1]
        const ext = match[2]
        if (ext === "jsonl") {
          subagentJsonls.set(agentId, file)
        } else {
          subagentMetas.set(agentId, file)
        }
      }
    }
  }

  if (!mainSessionFile) {
    // Fallback: treat the first .jsonl as main
    const firstJsonl = files.find(f => f.name.endsWith(".jsonl"))
    if (firstJsonl) mainSessionFile = firstJsonl
  }

  if (!mainSessionFile) {
    return { messages: [], sessionName: "Empty", subagentCount: 0 }
  }

  // Parse main session
  const mainText = await mainSessionFile.text()
  const messages = parseSessionJsonl(mainText)

  // Extract agent mapping from progress entries
  const agentMapping = extractAgentMapping(mainText) // toolUseId → agentId

  // Load and parse sub-agent sessions
  const subagentMessages = new Map<string, AgentMessage[]>() // agentId → messages
  const subagentMetaMap = new Map<string, SubagentMeta>()    // agentId → meta

  for (const [agentId, file] of subagentJsonls) {
    const text = await file.text()
    subagentMessages.set(agentId, parseSessionJsonl(text))
  }

  for (const [agentId, file] of subagentMetas) {
    try {
      const text = await file.text()
      subagentMetaMap.set(agentId, JSON.parse(text))
    } catch {
      // skip invalid meta
    }
  }

  // Attach sub-agent messages to parent tool_use entries
  for (const msg of messages) {
    if (msg.type === "tool_use" && (msg.name === "Agent" || msg.name === "Task") && msg.toolUseId) {
      const agentId = agentMapping.get(msg.toolUseId)
      if (agentId) {
        msg.subagentId = agentId
        const subMsgs = subagentMessages.get(agentId)
        if (subMsgs && subMsgs.length > 0) {
          msg.subagentMessages = subMsgs
        }
        const meta = subagentMetaMap.get(agentId)
        if (meta?.agentType && msg.input) {
          // Enrich input with subagent_type from meta if not already present
          if (!msg.input.subagent_type) {
            msg.input.subagent_type = meta.agentType
          }
        }
      }
    }
  }

  const sessionName = mainSessionFile.name.replace(".jsonl", "")
  return {
    messages,
    sessionName,
    subagentCount: subagentJsonls.size,
  }
}
