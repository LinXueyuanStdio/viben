/**
 * Structured demo steps — ALL original messages preserved.
 *
 * Each step groups tightly-coupled messages (e.g., tool_use + tool_result pair).
 * Steps with `awaitsInteraction` naturally stall the player until user resolves.
 */

import type { DemoStep } from "./use-step-player"
import type { AgentMessage, PendingExecApproval, PendingQuestion, TaskPlan } from "@viben/chat"

const NOW = Date.now()

// ============================================================================
// Reusable interaction data
// ============================================================================

const approvalRmRf: PendingExecApproval = {
  id: "approval-rm",
  tool_call: { title: "Execute shell command", kind: "execute", command: "rm -rf dist/ && rm -rf .cache/", cwd: "/Users/dev/project" },
  options: [
    { id: "allow_once", label: "Allow" },
    { id: "allow_always", label: "Always" },
    { id: "reject", label: "Reject" },
  ],
}

const approvalDbPush: PendingExecApproval = {
  id: "approval-db",
  tool_call: { title: "Reset database tables", kind: "execute", command: "pnpm db:push --force --accept-data-loss", cwd: "/Users/dev/project" },
  options: [
    { id: "allow_once", label: "Allow" },
    { id: "allow_always", label: "Always" },
    { id: "reject", label: "Reject" },
  ],
}

const approvalForcePush: PendingExecApproval = {
  id: "approval-force-push",
  tool_call: { title: "Force push to remote", kind: "execute", command: "git push --force origin main", cwd: "/Users/dev/project" },
  options: [
    { id: "allow_once", label: "Allow" },
    { id: "allow_always", label: "Always" },
    { id: "reject", label: "Reject" },
  ],
}

const questionPreferences: PendingQuestion = {
  id: "q-preferences",
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
}

const planImplementation: TaskPlan = {
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
}

// ============================================================================
// Helper
// ============================================================================

let _id = 0
function m(partial: Omit<AgentMessage, "id"> & { id?: string }): AgentMessage {
  return { id: partial.id || `s-${++_id}`, ...partial } as AgentMessage
}

// ============================================================================
// ALL STEPS (preserves every original message)
// ============================================================================

export const demoSteps: DemoStep[] = [
  // ==========================================================================
  // Phase 1: User request & initial exploration
  // ==========================================================================
  {
    messages: [m({ type: "user", content: "Help me build a full-stack user management dashboard with authentication, CRUD operations, and real-time updates.", timestamp: NOW - 600_000 })],
    delayMs: 800,
  },
  {
    messages: [m({ type: "thinking", content: "This is a complex request. I need to first understand the project structure, then propose a plan before implementing. Let me explore the codebase and identify existing patterns, then ask the user about their preferences for state management and features." })],
    delayMs: 600,
  },
  {
    messages: [m({ type: "text", content: "I'll help you build a user management dashboard. Let me first explore the project to understand the existing patterns." })],
    delayMs: 800,
  },
  {
    messages: [
      m({ type: "tool_use", name: "Glob", toolUseId: "tool-1", input: { pattern: "src/**/*.{tsx,ts}" } }),
      m({ type: "tool_result", toolUseId: "tool-1", output: "src/App.tsx\nsrc/main.tsx\nsrc/components/Button.tsx\nsrc/components/Card.tsx\nsrc/components/Layout.tsx\nsrc/lib/api.ts\nsrc/lib/auth.ts\nsrc/hooks/useQuery.ts" }),
    ],
    delayMs: 400,
  },
  {
    messages: [
      m({ type: "tool_use", name: "Read", toolUseId: "tool-2", input: { file_path: "src/lib/api.ts" } }),
      m({ type: "tool_result", toolUseId: "tool-2", output: 'import { createClient } from "@supabase/supabase-js";\n\nconst supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_KEY);\n\nexport { supabase };' }),
    ],
    delayMs: 300,
  },
  {
    messages: [
      m({ type: "tool_use", name: "Read", toolUseId: "tool-3", input: { file_path: "package.json" } }),
      m({ type: "tool_result", toolUseId: "tool-3", output: '{\n  "dependencies": {\n    "react": "^19.0.0",\n    "@supabase/supabase-js": "^2.45.0",\n    "tailwindcss": "^4.0.0",\n    "zod": "^3.23.0"\n  }\n}' }),
    ],
    delayMs: 300,
  },

  // ==========================================================================
  // Phase 2: Ask user questions (AWAITS interaction)
  // ==========================================================================
  {
    messages: [m({ type: "text", content: "I can see you're using Supabase, React 19, and Tailwind v4. Before I plan the implementation, I have a few questions about your preferences:" })],
    delayMs: 800,
  },
  {
    messages: [m({ type: "ask_question", content: "Asking user for preferences", questions: questionPreferences.questions })],
    awaitsInteraction: { type: "question", question: questionPreferences },
    delayMs: 500,
  },

  // ==========================================================================
  // Phase 3: User answers, agent proposes plan (AWAITS interaction)
  // ==========================================================================
  {
    messages: [m({ type: "user", content: "I'll go with Zustand for state management. Include dark mode, pagination, and real-time updates.", timestamp: NOW - 540_000 })],
    delayMs: 600,
  },
  {
    messages: [m({ type: "thinking", content: "Great, user chose Zustand + dark mode + pagination + real-time updates. Let me create a comprehensive plan using EnterPlanMode to get approval before coding." })],
    delayMs: 500,
  },
  {
    messages: [m({ type: "plan_mode", planModeAction: "enter", content: "Entering plan mode to design the implementation approach." })],
    delayMs: 400,
  },
  {
    messages: [m({ type: "plan", content: "Here's my proposed implementation plan:", plan: planImplementation })],
    awaitsInteraction: { type: "plan", plan: planImplementation },
    delayMs: 500,
  },

  // ==========================================================================
  // Phase 4: Plan approved, start implementation
  // ==========================================================================
  {
    messages: [m({ type: "user", content: "Looks good! Let's start with step 1.", timestamp: NOW - 480_000 })],
    delayMs: 600,
  },
  {
    messages: [m({ type: "plan_mode", planModeAction: "exit", content: "Plan approved. Starting implementation." })],
    delayMs: 300,
  },
  {
    messages: [m({ type: "text", content: "Plan approved! Starting with step 1: Setting up the Zustand store." })],
    delayMs: 800,
  },

  // ==========================================================================
  // Phase 5: Implementation with tool calls
  // ==========================================================================
  {
    messages: [
      m({ type: "tool_use", name: "Bash", toolUseId: "tool-4", input: { command: "pnpm add zustand" } }),
      m({ type: "tool_result", toolUseId: "tool-4", output: "Added zustand@5.0.0" }),
    ],
    delayMs: 500,
  },
  {
    messages: [
      m({ type: "tool_use", name: "Write", toolUseId: "tool-5", input: { file_path: "src/store/user-store.ts", content: 'import { create } from "zustand";\nimport { supabase } from "../lib/api";\n\ninterface User {\n  id: string;\n  name: string;\n  email: string;\n  role: "admin" | "user";\n  avatar_url?: string;\n  created_at: string;\n}\n\ninterface UserStore {\n  users: User[];\n  loading: boolean;\n  error: string | null;\n  fetchUsers: () => Promise<void>;\n  addUser: (user: Omit<User, "id" | "created_at">) => Promise<void>;\n  updateUser: (id: string, data: Partial<User>) => Promise<void>;\n  deleteUser: (id: string) => Promise<void>;\n}\n\nexport const useUserStore = create<UserStore>((set) => ({\n  users: [] as User[],\n  loading: false,\n  error: null,\n  fetchUsers: async () => {\n    set({ loading: true, error: null });\n    const { data, error } = await supabase.from("users").select("*");\n    set({ users: data || [], loading: false, error: error?.message || null });\n  },\n  addUser: async (user) => {\n    const { error } = await supabase.from("users").insert(user);\n    if (error) set({ error: error.message });\n  },\n  updateUser: async (id, data) => {\n    const { error } = await supabase.from("users").update(data).eq("id", id);\n    if (error) set({ error: error.message });\n  },\n  deleteUser: async (id) => {\n    const { error } = await supabase.from("users").delete().eq("id", id);\n    if (error) set({ error: error.message });\n  },\n}));' } }),
      m({ type: "tool_result", toolUseId: "tool-5", output: "File written successfully." }),
    ],
    delayMs: 500,
  },
  {
    messages: [m({ type: "text", content: "Zustand store is set up. Now let me create the UserList component with search and pagination. I need to install a few more packages first." })],
    delayMs: 800,
  },

  // ==========================================================================
  // Phase 6: Dangerous command triggers exec approval (AWAITS)
  // ==========================================================================
  {
    messages: [m({ type: "tool_use", name: "Bash", toolUseId: "tool-6", input: { command: "rm -rf dist/ && pnpm build" } })],
    awaitsInteraction: { type: "approval", approval: approvalRmRf },
    delayMs: 400,
  },
  // After approval resolved, show result
  {
    messages: [m({ type: "tool_result", toolUseId: "tool-6", output: "Build completed successfully." })],
    delayMs: 300,
  },

  // ==========================================================================
  // Phase 7: Continue after approval, more tool calls
  // ==========================================================================
  {
    messages: [
      m({ type: "tool_use", name: "Write", toolUseId: "tool-7", input: { file_path: "src/components/UserList.tsx", content: 'import { useState, useMemo, useEffect } from "react";\nimport { useUserStore } from "../store/user-store";\n\nexport function UserList() {\n  const { users, loading, fetchUsers } = useUserStore();\n  const [search, setSearch] = useState("");\n  const [page, setPage] = useState(1);\n  const perPage = 10;\n\n  useEffect(() => { fetchUsers(); }, [fetchUsers]);\n\n  const filtered = useMemo(\n    () => users.filter(u => u.name.toLowerCase().includes(search.toLowerCase())),\n    [users, search]\n  );\n  const paged = filtered.slice((page - 1) * perPage, page * perPage);\n  const totalPages = Math.ceil(filtered.length / perPage);\n\n  if (loading) return <div className="animate-pulse">Loading...</div>;\n\n  return (\n    <div className="space-y-4">\n      <input placeholder="Search users..." value={search}\n        onChange={e => setSearch(e.target.value)}\n        className="w-full rounded-lg border px-3 py-2" />\n      {paged.map(user => (\n        <div key={user.id} className="flex items-center gap-3 rounded-lg border p-3">\n          <div className="h-10 w-10 rounded-full bg-primary/20" />\n          <div className="flex-1">\n            <p className="font-medium">{user.name}</p>\n            <p className="text-sm text-muted-foreground">{user.email}</p>\n          </div>\n          <span className="text-xs bg-muted px-2 py-1 rounded">{user.role}</span>\n        </div>\n      ))}\n      <div className="flex justify-center gap-2">\n        <button disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Prev</button>\n        <span>{page}/{totalPages}</span>\n        <button disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>Next</button>\n      </div>\n    </div>\n  );\n}' } }),
      m({ type: "tool_result", toolUseId: "tool-7", output: "File written successfully." }),
    ],
    delayMs: 500,
  },

  // ==========================================================================
  // Phase 8: Error scenario (typecheck fails, fix, re-verify)
  // ==========================================================================
  {
    messages: [
      m({ type: "tool_use", name: "Bash", toolUseId: "tool-8", input: { command: "pnpm typecheck" } }),
      m({ type: "tool_result", toolUseId: "tool-8", output: "src/store/user-store.ts:15:3 - error TS2345: Argument of type '{ users: never[]; }' is not assignable.\nsrc/components/UserList.tsx:8:22 - error TS7006: Parameter 'u' implicitly has 'any' type.", isError: true }),
    ],
    delayMs: 500,
  },
  {
    messages: [m({ type: "thinking", content: "There are TypeScript errors. The users array needs proper typing and the filter callback needs explicit types. Let me fix these issues." })],
    delayMs: 400,
  },
  {
    messages: [m({ type: "text", content: "I see some TypeScript errors. Let me fix the type issues in both files." })],
    delayMs: 600,
  },
  {
    messages: [
      m({ type: "tool_use", name: "Edit", toolUseId: "tool-9", input: { file_path: "src/store/user-store.ts", old_string: "users: [],", new_string: "users: [] as User[]," } }),
      m({ type: "tool_result", toolUseId: "tool-9", output: "File edited successfully." }),
    ],
    delayMs: 400,
  },

  // ==========================================================================
  // Phase 9: Running tests after fix
  // ==========================================================================
  {
    messages: [
      m({ type: "tool_use", name: "Bash", toolUseId: "tool-10", input: { command: "pnpm typecheck" } }),
      m({ type: "tool_result", toolUseId: "tool-10", output: "No errors found." }),
    ],
    delayMs: 400,
  },
  {
    messages: [m({ type: "text", content: "TypeScript errors are fixed. Here's a summary of what's been implemented so far:\n\n**Completed:**\n- Zustand store with full CRUD actions (`src/store/user-store.ts`)\n- UserList component with search + pagination (`src/components/UserList.tsx`)\n\n**Remaining:**\n- Create/Edit user forms with Zod validation\n- Supabase real-time subscriptions\n- Dark mode theme toggle\n- Unit tests\n\nShall I continue with the next step?" })],
    delayMs: 1200,
  },

  // ==========================================================================
  // Phase 10: User sends more messages
  // ==========================================================================
  {
    messages: [m({ type: "user", content: "Yes, continue with the forms. Also add the dark mode toggle while you're at it.", timestamp: NOW - 420_000 })],
    delayMs: 600,
  },
  {
    messages: [m({ type: "thinking", content: "The user wants forms + dark mode. I'll implement both in parallel. Let me first add the dark mode since it's simpler, then the forms with Zod validation." })],
    delayMs: 500,
  },
  {
    messages: [
      m({ type: "tool_use", name: "Write", toolUseId: "tool-11", input: { file_path: "src/components/ThemeToggle.tsx", content: 'import { Sun, Moon } from "lucide-react";\nimport { useThemeStore } from "../store/theme-store";\n\nexport function ThemeToggle() {\n  const { dark, toggle } = useThemeStore();\n  return (\n    <button onClick={toggle} className="p-2 rounded-lg hover:bg-accent">\n      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}\n    </button>\n  );\n}' } }),
      m({ type: "tool_result", toolUseId: "tool-11", output: "File written successfully." }),
    ],
    delayMs: 400,
  },
  {
    messages: [
      m({ type: "tool_use", name: "Write", toolUseId: "tool-12", input: { file_path: "src/components/UserForm.tsx", content: 'import { useForm } from "react-hook-form";\nimport { zodResolver } from "@hookform/resolvers/zod";\nimport { z } from "zod";\n\nconst userSchema = z.object({\n  name: z.string().min(2, "Name must be at least 2 characters"),\n  email: z.string().email("Invalid email address"),\n  role: z.enum(["admin", "user"]),\n});\n\ntype UserFormData = z.infer<typeof userSchema>;\n\nexport function UserForm({ onSubmit, defaultValues }: {\n  onSubmit: (data: UserFormData) => void;\n  defaultValues?: Partial<UserFormData>;\n}) {\n  const { register, handleSubmit, formState: { errors } } = useForm<UserFormData>({\n    resolver: zodResolver(userSchema),\n    defaultValues,\n  });\n\n  return (\n    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">\n      <div>\n        <input {...register("name")} placeholder="Name" className="input" />\n        {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}\n      </div>\n      <div>\n        <input {...register("email")} placeholder="Email" className="input" />\n        {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}\n      </div>\n      <select {...register("role")} className="input">\n        <option value="user">User</option>\n        <option value="admin">Admin</option>\n      </select>\n      <button type="submit" className="btn-primary">Save</button>\n    </form>\n  );\n}' } }),
      m({ type: "tool_result", toolUseId: "tool-12", output: "File written successfully." }),
    ],
    delayMs: 500,
  },
  {
    messages: [m({ type: "text", content: "All major components are now implemented:\n\n1. **ThemeToggle** -- Dark/light mode switch using a Zustand theme store\n2. **UserForm** -- Create/edit form with Zod validation for name, email, and role\n3. **UserList** -- Search + pagination powered by Zustand user store\n4. **User Store** -- Full CRUD with Supabase integration\n\nNow let me wire up real-time subscriptions and review the full project." })],
    delayMs: 1000,
  },

  // ==========================================================================
  // Phase A: Collapsed Tool Groups (5 consecutive Reads + 3 Greps)
  // ==========================================================================
  {
    messages: [m({ type: "text", content: "Let me review all the existing components to make sure the real-time subscriptions integrate correctly." })],
    delayMs: 600,
  },
  {
    messages: [
      m({ type: "tool_use", name: "Read", toolUseId: "tool-cg-1", input: { file_path: "src/components/UserList.tsx" } }),
      m({ type: "tool_result", toolUseId: "tool-cg-1", output: '// UserList component\nimport { useState, useMemo, useEffect } from "react";\nimport { useUserStore } from "../store/user-store";\n\nexport function UserList() {\n  const { users, loading, fetchUsers } = useUserStore();\n  const [search, setSearch] = useState("");\n  // ... 45 lines ...' }),
    ],
    delayMs: 250,
  },
  {
    messages: [
      m({ type: "tool_use", name: "Read", toolUseId: "tool-cg-2", input: { file_path: "src/components/UserForm.tsx" } }),
      m({ type: "tool_result", toolUseId: "tool-cg-2", output: '// UserForm component\nimport { useForm } from "react-hook-form";\nimport { zodResolver } from "@hookform/resolvers/zod";\nimport { z } from "zod";\n\nconst userSchema = z.object({\n  name: z.string().min(2),\n  // ... 38 lines ...' }),
    ],
    delayMs: 250,
  },
  {
    messages: [
      m({ type: "tool_use", name: "Read", toolUseId: "tool-cg-3", input: { file_path: "src/store/user-store.ts" } }),
      m({ type: "tool_result", toolUseId: "tool-cg-3", output: 'import { create } from "zustand";\nimport { supabase } from "../lib/api";\n\ninterface User {\n  id: string;\n  name: string;\n  email: string;\n  role: "admin" | "user";\n  // ... 32 lines ...' }),
    ],
    delayMs: 250,
  },
  {
    messages: [
      m({ type: "tool_use", name: "Read", toolUseId: "tool-cg-4", input: { file_path: "src/components/ThemeToggle.tsx" } }),
      m({ type: "tool_result", toolUseId: "tool-cg-4", output: 'import { Sun, Moon } from "lucide-react";\nimport { useThemeStore } from "../store/theme-store";\n\nexport function ThemeToggle() {\n  const { dark, toggle } = useThemeStore();\n  // ... 8 lines ...' }),
    ],
    delayMs: 250,
  },
  {
    messages: [
      m({ type: "tool_use", name: "Read", toolUseId: "tool-cg-5", input: { file_path: "src/lib/auth.ts" } }),
      m({ type: "tool_result", toolUseId: "tool-cg-5", output: 'import { supabase } from "./api";\n\nexport async function signIn(email: string, password: string) {\n  const { data, error } = await supabase.auth.signInWithPassword({ email, password });\n  if (error) throw error;\n  return data;\n}\n\nexport async function signUp(email: string, password: string) {\n  const { data, error } = await supabase.auth.signUp({ email, password });\n  if (error) throw error;\n  return data;\n}' }),
    ],
    delayMs: 250,
  },
  // Grep group
  {
    messages: [
      m({ type: "tool_use", name: "Grep", toolUseId: "tool-cg-6", input: { pattern: "useEffect", path: "src/" } }),
      m({ type: "tool_result", toolUseId: "tool-cg-6", output: "src/components/UserList.tsx:1:import { useState, useMemo, useEffect } from \"react\";\nsrc/components/UserList.tsx:9:  useEffect(() => { fetchUsers(); }, [fetchUsers]);\nsrc/App.tsx:3:import { useEffect } from \"react\";" }),
    ],
    delayMs: 250,
  },
  {
    messages: [
      m({ type: "tool_use", name: "Grep", toolUseId: "tool-cg-7", input: { pattern: "supabase\\.from", path: "src/" } }),
      m({ type: "tool_result", toolUseId: "tool-cg-7", output: "src/store/user-store.ts:22:    const { data, error } = await supabase.from(\"users\").select(\"*\");\nsrc/store/user-store.ts:26:    const { error } = await supabase.from(\"users\").insert(user);\nsrc/store/user-store.ts:30:    const { error } = await supabase.from(\"users\").update(data).eq(\"id\", id);\nsrc/store/user-store.ts:34:    const { error } = await supabase.from(\"users\").delete().eq(\"id\", id);" }),
    ],
    delayMs: 250,
  },
  {
    messages: [
      m({ type: "tool_use", name: "Grep", toolUseId: "tool-cg-8", input: { pattern: "realtime|subscribe|channel", path: "src/" } }),
      m({ type: "tool_result", toolUseId: "tool-cg-8", output: "(no matches found)" }),
    ],
    delayMs: 300,
  },

  // ==========================================================================
  // Phase B: Multiple ExecApproval scenarios
  // ==========================================================================
  {
    messages: [m({ type: "text", content: "Good, no real-time subscriptions exist yet. Before I add them, let me clean up the build artifacts and prepare the project." })],
    delayMs: 600,
  },
  // Approval scenario 1: file deletion (AWAITS)
  {
    messages: [m({ type: "tool_use", name: "Bash", toolUseId: "tool-ea-1", input: { command: "rm -rf dist/ && rm -rf .cache/" } })],
    awaitsInteraction: { type: "approval", approval: approvalRmRf },
    delayMs: 400,
  },
  {
    messages: [m({ type: "tool_result", toolUseId: "tool-ea-1", output: "Directories removed." })],
    delayMs: 300,
  },
  // Approval scenario 2: database migration (AWAITS)
  {
    messages: [m({ type: "tool_use", name: "Bash", toolUseId: "tool-ea-2", input: { command: "# Drop and recreate database tables\npnpm db:push --force" } })],
    awaitsInteraction: { type: "approval", approval: approvalDbPush },
    delayMs: 400,
  },
  {
    messages: [m({ type: "tool_result", toolUseId: "tool-ea-2", output: "Database schema pushed successfully.\n  + users (created)\n  + sessions (created)\n  + audit_log (created)" })],
    delayMs: 300,
  },
  // Approval scenario 3: force push (AWAITS)
  {
    messages: [m({ type: "tool_use", name: "Bash", toolUseId: "tool-ea-3", input: { command: "git push --force origin main" } })],
    awaitsInteraction: { type: "approval", approval: approvalForcePush },
    delayMs: 400,
  },
  {
    messages: [m({ type: "tool_result", toolUseId: "tool-ea-3", output: "To github.com:user/project.git\n + abc1234...def5678 main -> main (forced update)" })],
    delayMs: 300,
  },

  // ==========================================================================
  // Phase C: Edit/Write operations (file creation & modification)
  // ==========================================================================
  {
    messages: [m({ type: "thinking", content: "Now I need to create the real-time subscription hook and the user store update. Let me also create an auth store for managing login state." })],
    delayMs: 500,
  },
  {
    messages: [
      m({ type: "tool_use", name: "Write", toolUseId: "tool-w-1", input: { file_path: "src/stores/user-store.ts", content: "import { create } from 'zustand';\n\ninterface UserStore {\n  users: User[];\n  loading: boolean;\n  fetchUsers: () => Promise<void>;\n}\n\nexport const useUserStore = create<UserStore>((set) => ({\n  users: [],\n  loading: false,\n  fetchUsers: async () => {\n    set({ loading: true });\n    const response = await fetch('/api/users');\n    const users = await response.json();\n    set({ users, loading: false });\n  },\n}));" } }),
      m({ type: "tool_result", toolUseId: "tool-w-1", output: "File created successfully" }),
    ],
    delayMs: 400,
  },
  {
    messages: [
      m({ type: "tool_use", name: "Write", toolUseId: "tool-w-2", input: { file_path: "src/hooks/useRealtimeUsers.ts", content: 'import { useEffect } from "react";\nimport { supabase } from "../lib/api";\nimport { useUserStore } from "../store/user-store";\n\nexport function useRealtimeUsers() {\n  const fetchUsers = useUserStore((s) => s.fetchUsers);\n\n  useEffect(() => {\n    const channel = supabase\n      .channel("users-changes")\n      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, () => {\n        fetchUsers();\n      })\n      .subscribe();\n\n    return () => {\n      supabase.removeChannel(channel);\n    };\n  }, [fetchUsers]);\n}' } }),
      m({ type: "tool_result", toolUseId: "tool-w-2", output: "File created successfully" }),
    ],
    delayMs: 400,
  },
  {
    messages: [
      m({ type: "tool_use", name: "Edit", toolUseId: "tool-e-1", input: { file_path: "src/App.tsx", old_string: "import { BrowserRouter }", new_string: "import { BrowserRouter, Routes, Route }" } }),
      m({ type: "tool_result", toolUseId: "tool-e-1", output: "File modified successfully" }),
    ],
    delayMs: 350,
  },
  {
    messages: [
      m({ type: "tool_use", name: "Edit", toolUseId: "tool-e-2", input: { file_path: "src/components/UserList.tsx", old_string: 'import { useUserStore } from "../store/user-store";', new_string: 'import { useUserStore } from "../store/user-store";\nimport { useRealtimeUsers } from "../hooks/useRealtimeUsers";' } }),
      m({ type: "tool_result", toolUseId: "tool-e-2", output: "File modified successfully" }),
    ],
    delayMs: 350,
  },
  {
    messages: [
      m({ type: "tool_use", name: "Edit", toolUseId: "tool-e-3", input: { file_path: "src/components/UserList.tsx", old_string: "useEffect(() => { fetchUsers(); }, [fetchUsers]);", new_string: "useRealtimeUsers();\n  useEffect(() => { fetchUsers(); }, [fetchUsers]);" } }),
      m({ type: "tool_result", toolUseId: "tool-e-3", output: "File modified successfully" }),
    ],
    delayMs: 350,
  },

  // ==========================================================================
  // Phase D: Error recovery flow
  // ==========================================================================
  {
    messages: [m({ type: "text", content: "Real-time subscriptions are wired up. Let me verify everything compiles correctly." })],
    delayMs: 600,
  },
  {
    messages: [
      m({ type: "tool_use", name: "Bash", toolUseId: "tool-err-1", input: { command: "pnpm typecheck" } }),
      m({ type: "tool_result", toolUseId: "tool-err-1", output: "src/stores/user-store.ts(15,3): error TS2345: Argument of type '{ users: never[]; }' is not assignable to parameter of type 'UserStore'.\nsrc/components/UserList.tsx(8,5): error TS7006: Parameter 'user' implicitly has an 'any' type.\n\nFound 2 errors.", isError: true }),
    ],
    delayMs: 500,
  },
  {
    messages: [m({ type: "thinking", content: "The typecheck failed with 2 errors. I need to add proper types to the store and component. The User type is missing from the new user-store file, and the UserList filter callback needs explicit typing." })],
    delayMs: 400,
  },
  {
    messages: [
      m({ type: "tool_use", name: "Edit", toolUseId: "tool-err-2", input: { file_path: "src/stores/user-store.ts", old_string: "users: [],", new_string: "users: [] as User[]," } }),
      m({ type: "tool_result", toolUseId: "tool-err-2", output: "File modified successfully" }),
    ],
    delayMs: 350,
  },
  {
    messages: [
      m({ type: "tool_use", name: "Edit", toolUseId: "tool-err-3", input: { file_path: "src/components/UserList.tsx", old_string: "() => users.filter(u =>", new_string: "() => users.filter((u: User) =>" } }),
      m({ type: "tool_result", toolUseId: "tool-err-3", output: "File modified successfully" }),
    ],
    delayMs: 350,
  },
  {
    messages: [
      m({ type: "tool_use", name: "Bash", toolUseId: "tool-err-4", input: { command: "pnpm typecheck" } }),
      m({ type: "tool_result", toolUseId: "tool-err-4", output: "TypeScript: 0 errors found." }),
    ],
    delayMs: 400,
  },
  {
    messages: [m({ type: "text", content: "All type errors are fixed. The project compiles cleanly now." })],
    delayMs: 800,
  },

  // ==========================================================================
  // Phase E: Sub-agent / Task tool
  // ==========================================================================
  {
    messages: [m({ type: "user", content: "Great, now please write unit tests for the user store and components.", timestamp: NOW - 300_000 })],
    delayMs: 800,
  },
  {
    messages: [m({ type: "thinking", content: "The user wants unit tests. I'll delegate this to a test-runner sub-agent since it's a self-contained task that can run in parallel." })],
    delayMs: 400,
  },
  // Sub-agent starts (shows as running with spinner)
  {
    messages: [
      m({ type: "tool_use", name: "Agent", toolUseId: "tool-task-1", input: { description: "Write unit tests for user-store and UserList component", subagent_type: "test-runner", prompt: "Write comprehensive unit tests for:\n1. src/stores/user-store.ts - test all CRUD operations, loading states, error handling\n2. src/components/UserList.tsx - test rendering, search filtering, pagination\n\nUse vitest + @testing-library/react. Ensure full coverage of edge cases." }, subagentId: "sub-test-1" }),
    ],
    delayMs: 2500,
  },
  // Sub-agent completes (result arrives)
  {
    messages: [
      m({ type: "tool_result", toolUseId: "tool-task-1", output: "Sub-agent completed successfully.\n\nFiles created:\n  - src/__tests__/user-store.test.ts (8 tests)\n  - src/__tests__/UserList.test.tsx (4 tests)\n\nResults: 12 passing, 0 failing.\n\nCoverage:\n  user-store.ts: 94% statements, 88% branches\n  UserList.tsx: 91% statements, 85% branches" }),
    ],
    delayMs: 800,
  },
  {
    messages: [m({ type: "text", content: "The test sub-agent has created comprehensive tests:\n\n- **user-store.test.ts** -- 8 tests covering CRUD, loading states, and error handling\n- **UserList.test.tsx** -- 4 tests covering rendering, search, and pagination\n\nAll 12 tests pass with good coverage." })],
    delayMs: 1000,
  },

  // ==========================================================================
  // Phase F: Web search/fetch
  // ==========================================================================
  {
    messages: [m({ type: "thinking", content: "Let me check if there are any known issues with Zustand v5 and Supabase realtime that I should be aware of before finalizing." })],
    delayMs: 400,
  },
  {
    messages: [
      m({ type: "tool_use", name: "WebSearch", toolUseId: "tool-web-1", input: { query: "zustand v5 supabase realtime subscription best practices 2026" } }),
      m({ type: "tool_result", toolUseId: "tool-web-1", output: "1. Zustand v5 Migration Guide - docs.pmnd.rs/zustand/migrations/v5\n   \"Key change: create() no longer accepts generic. Use createStore() for type-safe stores.\"\n\n2. Supabase Realtime + React Best Practices - supabase.com/docs/guides/realtime\n   \"Always clean up channel subscriptions in useEffect cleanup.\"\n\n3. Zustand 5: Breaking Changes - github.com/pmndrs/zustand/releases/tag/v5.0.0\n   \"Removed: devtools middleware default import. Use { devtools } named import.\"\n\n4. Full-Stack React Dashboard Tutorial 2026 - dev.to/dashboard-guide\n   \"Combining Zustand + Supabase Realtime for live dashboards.\"" }),
    ],
    delayMs: 500,
  },
  {
    messages: [
      m({ type: "tool_use", name: "WebFetch", toolUseId: "tool-web-2", input: { url: "https://docs.pmnd.rs/zustand/migrations/v5" } }),
      m({ type: "tool_result", toolUseId: "tool-web-2", output: "# Zustand v5 Migration Guide\n\n## Breaking Changes\n\n1. `create()` generic syntax changed:\n   ```ts\n   // Before (v4)\n   const useStore = create<State>()(/* ... */)\n   // After (v5)\n   const useStore = create<State>(/* ... */)\n   ```\n\n2. `devtools` middleware:\n   ```ts\n   // Before\n   import create from 'zustand/devtools'\n   // After\n   import { devtools } from 'zustand/middleware'\n   ```\n\n3. Subscription selectors are now shallow by default.\n\n## Supabase Integration Tips\n- Use `immer` middleware for complex state mutations\n- Clean up realtime channels in useEffect return" }),
    ],
    delayMs: 500,
  },
  {
    messages: [m({ type: "text", content: "I've reviewed the latest Zustand v5 migration guide. Our implementation already follows the correct patterns. The realtime hook properly cleans up subscriptions in the useEffect cleanup function." })],
    delayMs: 800,
  },

  // ==========================================================================
  // Phase G: Final success run
  // ==========================================================================
  {
    messages: [m({ type: "text", content: "Let me do a final verification to make sure everything builds and tests pass." })],
    delayMs: 600,
  },
  {
    messages: [
      m({ type: "tool_use", name: "Bash", toolUseId: "tool-final-1", input: { command: "pnpm typecheck && pnpm test" } }),
      m({ type: "tool_result", toolUseId: "tool-final-1", output: "TypeScript: 0 errors\n\n PASS  src/__tests__/user-store.test.ts (8 tests)\n PASS  src/__tests__/UserList.test.tsx (4 tests)\n\nTest Suites: 2 passed, 2 total\nTests:       12 passed, 12 total\nSnapshots:   0 total\nTime:        3.412s" }),
    ],
    delayMs: 500,
  },
  {
    messages: [
      m({ type: "tool_use", name: "Bash", toolUseId: "tool-final-2", input: { command: "pnpm build" } }),
      m({ type: "tool_result", toolUseId: "tool-final-2", output: "vite v6.0.0 building for production...\n\n  dist/index.html                  0.45 kB | gzip: 0.29 kB\n  dist/assets/index-abc123.css    12.34 kB | gzip:  3.21 kB\n  dist/assets/index-def456.js     89.67 kB | gzip: 28.45 kB\n\nBuild completed in 2.1s." }),
    ],
    delayMs: 500,
  },
  {
    messages: [m({ type: "result", content: "I've implemented the full-stack user management dashboard with:\n\n1. **Authentication** -- Login/signup with Supabase Auth (`src/lib/auth.ts`)\n2. **User Store** -- Zustand state management with typed CRUD operations (`src/store/user-store.ts`)\n3. **CRUD Operations** -- Full user table with create, edit, and delete via forms (`src/components/UserForm.tsx`, `src/components/UserList.tsx`)\n4. **Real-time Updates** -- Supabase realtime subscriptions with automatic refresh (`src/hooks/useRealtimeUsers.ts`)\n5. **Dark Mode** -- Theme toggle with Zustand theme store (`src/components/ThemeToggle.tsx`)\n6. **Tests** -- 12 unit tests covering store logic and component rendering\n\nAll TypeScript checks pass, all tests are green, and the production build succeeds.", timestamp: NOW - 120_000 })],
    delayMs: 1000,
  },

  // ==========================================================================
  // Phase H: Command Queue — user input queued during slow tool execution
  //
  // KEY DEMO: The agent starts a SLOW tool call. While the tool is executing
  // (tool_use emitted, result not yet back), user messages arrive — these
  // represent messages that were typed and queued during execution. After the
  // tool finishes and the agent processes them, the queued messages appear.
  //
  // In the real app flow:
  // 1. Agent emits tool_use → isStreaming=true → input goes to queue
  // 2. User types messages → they sit in CommandQueuePanel
  // 3. tool_result arrives → agent continues
  // 4. Agent finishes turn → isStreaming=false → queue auto-dequeues
  // 5. Queued messages inject into message list as user bubbles
  //
  // In this scripted demo, we simulate this by:
  // - Emitting tool_use ALONE (long delay = simulates execution time)
  // - Then showing user messages that "arrived during execution"
  // - Then emitting tool_result (execution finished)
  // - Agent acknowledges the queued input
  // ==========================================================================
  {
    messages: [m({ type: "user", content: "Also add a CSV export feature for the user list.", timestamp: NOW - 90_000 })],
    delayMs: 600,
  },
  {
    messages: [m({ type: "thinking", content: "The user wants CSV export. I'll add a download button to the UserList that exports the current filtered data as CSV. Let me first read the existing component." })],
    delayMs: 500,
  },
  // Agent starts executing a tool — this takes time (2.5s simulated)
  // During this time the UI shows the "executing" spinner on the tool
  {
    messages: [m({ type: "tool_use", name: "Read", toolUseId: "tool-q-1", input: { file_path: "src/components/UserList.tsx" } })],
    delayMs: 2500, // ← Slow execution: user has time to type
  },
  // Tool finishes — result arrives
  {
    messages: [m({ type: "tool_result", toolUseId: "tool-q-1", output: 'import { useState, useMemo, useEffect } from "react";\nimport { useUserStore } from "../store/user-store";\n\nexport function UserList() {\n  const { users, loading, fetchUsers } = useUserStore();\n  const [search, setSearch] = useState("");\n  const [page, setPage] = useState(1);\n  const perPage = 10;\n  // ... 45 lines total' })],
    delayMs: 300,
  },
  // Agent starts writing a new file — another slow operation (3s)
  // DURING this step, user messages appear in the CommandQueuePanel
  {
    messages: [m({ type: "tool_use", name: "Write", toolUseId: "tool-q-2", input: { file_path: "src/utils/export-csv.ts", content: 'import type { User } from "../store/user-store";\n\nexport function exportToCSV(users: User[], columns?: string[]) {\n  const allColumns = ["id", "name", "email", "role", "avatar_url", "created_at"];\n  const headers = columns || allColumns;\n  const rows = users.map(u =>\n    headers.map(h => JSON.stringify((u as Record<string, unknown>)[h] ?? "")).join(",")\n  );\n  const csv = [headers.join(","), ...rows].join("\\n");\n  const blob = new Blob([csv], { type: "text/csv" });\n  const url = URL.createObjectURL(blob);\n  const a = document.createElement("a");\n  a.href = url;\n  a.download = `users-export-${Date.now()}.csv`;\n  a.click();\n  URL.revokeObjectURL(url);\n}' } })],
    delayMs: 1500,
  },
  // ── USER TYPES WHILE TOOL IS EXECUTING ──
  // These are user messages arriving while agent is busy (isStreaming=true).
  // The App routes them through the command queue automatically.
  // They appear in the CommandQueuePanel until the agent finishes.
  {
    messages: [m({ type: "user", content: "Make sure the CSV includes all columns, not just the visible ones.", timestamp: NOW - 88_000 })],
    delayMs: 1200,
  },
  {
    messages: [m({ type: "user", content: "And add a date range filter too while you're at it.", timestamp: NOW - 87_000 })],
    delayMs: 1500,
  },
  // Tool result arrives (the Write finishes)
  {
    messages: [m({ type: "tool_result", toolUseId: "tool-q-2", output: "File created successfully" })],
    delayMs: 400,
  },
  // Agent now processes the dequeued user requests
  {
    messages: [m({ type: "thinking", content: "I see the user sent two additional requests while I was writing the file:\n1. Include ALL columns in CSV (not just visible) — already done, I used allColumns\n2. Add a date range filter — I'll add this to UserList next\n\nLet me address both." })],
    delayMs: 500,
  },
  // Agent starts the Edit for date range — another slow operation (2s)
  {
    messages: [m({ type: "tool_use", name: "Edit", toolUseId: "tool-q-3", input: { file_path: "src/components/UserList.tsx", old_string: 'const [search, setSearch] = useState("");', new_string: 'const [search, setSearch] = useState("");\n  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);' } })],
    delayMs: 2000,
  },
  {
    messages: [m({ type: "tool_result", toolUseId: "tool-q-3", output: "File modified successfully" })],
    delayMs: 300,
  },
  // Agent adds the filter logic
  {
    messages: [m({ type: "tool_use", name: "Edit", toolUseId: "tool-q-4", input: { file_path: "src/components/UserList.tsx", old_string: "const filtered = useMemo(\n    () => users.filter(u => u.name.toLowerCase().includes(search.toLowerCase())),", new_string: "const filtered = useMemo(\n    () => users.filter(u => {\n      const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase());\n      const [start, end] = dateRange;\n      const created = new Date(u.created_at);\n      const matchesDate = (!start || created >= start) && (!end || created <= end);\n      return matchesSearch && matchesDate;\n    })," } })],
    delayMs: 1500,
  },
  {
    messages: [m({ type: "tool_result", toolUseId: "tool-q-4", output: "File modified successfully" })],
    delayMs: 300,
  },
  {
    messages: [m({ type: "text", content: "Done! I noticed you sent messages while I was working — I've addressed both:\n\n1. **CSV export** — `src/utils/export-csv.ts` exports ALL columns by default (id, name, email, role, avatar_url, created_at). You can optionally pass a columns array to limit.\n2. **Date range filter** — Added `dateRange` state to UserList with start/end date filtering on `created_at`.\n\nBoth features integrate with the existing search and pagination." })],
    delayMs: 1000,
  },

  // ==========================================================================
  // Phase I: Standalone error message (connection/crash)
  // ==========================================================================
  {
    messages: [m({ type: "error", message: "Connection to agent lost unexpectedly. The agent process exited with code 137 (OOM killed). Please retry your request." })],
    delayMs: 800,
  },
  {
    messages: [m({ type: "user", content: "Retry the last operation.", timestamp: NOW - 70_000 })],
    delayMs: 600,
  },
  {
    messages: [m({ type: "text", content: "Reconnected. Let me pick up where I left off." })],
    delayMs: 500,
  },

  // ==========================================================================
  // Phase J: Tool queued/executing animation (split steps)
  // ==========================================================================
  {
    messages: [m({ type: "text", content: "Let me run the full test suite with coverage to verify everything." })],
    delayMs: 600,
  },
  {
    messages: [m({ type: "tool_use", name: "Bash", toolUseId: "tool-anim-1", input: { command: "pnpm test --coverage --reporter=verbose" } })],
    delayMs: 2000, // Long delay to show executing animation
  },
  {
    messages: [m({ type: "tool_result", toolUseId: "tool-anim-1", output: "\u2713 user-store.test.ts (8 tests) \u2014 94% coverage\n\u2713 UserList.test.tsx (4 tests) \u2014 91% coverage\n\u2713 UserForm.test.tsx (3 tests) \u2014 88% coverage\n\u2713 export-csv.test.ts (2 tests) \u2014 100% coverage\n\nTest Suites: 4 passed, 4 total\nTests:       17 passed, 17 total\nCoverage:    92% statements, 87% branches" })],
    delayMs: 400,
  },
  // Another split tool call - Read with a medium delay
  {
    messages: [m({ type: "tool_use", name: "Read", toolUseId: "tool-anim-2", input: { file_path: "coverage/lcov-report/index.html" } })],
    delayMs: 1200,
  },
  {
    messages: [m({ type: "tool_result", toolUseId: "tool-anim-2", output: "<!DOCTYPE html><html>...Coverage report shows 92% overall..." })],
    delayMs: 300,
  },

  // ==========================================================================
  // Phase K: Expected warnings (amber instead of red)
  // ==========================================================================
  {
    messages: [m({ type: "text", content: "Let me check if there's an existing CSV utility we can build on." })],
    delayMs: 600,
  },
  {
    messages: [
      m({ type: "tool_use", name: "Read", toolUseId: "tool-warn-1", input: { file_path: "src/utils/csv-export.ts" } }),
      m({ type: "tool_result", toolUseId: "tool-warn-1", output: "File does not exist: src/utils/csv-export.ts", isError: true }),
    ],
    delayMs: 400,
  },
  {
    messages: [
      m({ type: "tool_use", name: "Grep", toolUseId: "tool-warn-2", input: { pattern: "exportCSV|csv_export|toCSV", path: "src/" } }),
      m({ type: "tool_result", toolUseId: "tool-warn-2", output: "No matches found.", isError: true }),
    ],
    delayMs: 400,
  },
  {
    messages: [
      m({ type: "tool_use", name: "Bash", toolUseId: "tool-warn-3", input: { command: "grep -r 'csv' src/" } }),
      m({ type: "tool_result", toolUseId: "tool-warn-3", output: "exit code 1: no matches", isError: true }),
    ],
    delayMs: 400,
  },
  {
    messages: [m({ type: "text", content: "No existing CSV utility found. I'll create one from scratch." })],
    delayMs: 600,
  },

  // ==========================================================================
  // Phase L: User messages with attachments
  // ==========================================================================
  {
    messages: [m({ type: "user", content: "Here's the design mockup for the export dialog:", attachments: [{ id: "att-img-1", type: "image", name: "export-dialog-mockup.png", data: "https://placehold.co/800x600/1a1a2e/eaeaea?text=Export+Dialog+Mockup" }], timestamp: NOW - 60_000 })],
    delayMs: 800,
  },
  {
    messages: [m({ type: "user", content: "And here's the CSV format spec:", attachments: [{ id: "att-file-1", type: "file", name: "csv-format-spec.md", path: "/Users/dev/project/docs/csv-format-spec.md" }], timestamp: NOW - 58_000 })],
    delayMs: 600,
  },
  {
    messages: [m({ type: "thinking", content: "The user provided a mockup for the export dialog and a CSV format specification file. I should reference both when implementing the export feature." })],
    delayMs: 500,
  },
  {
    messages: [m({ type: "text", content: "I can see the mockup and the spec file. I'll implement the export dialog matching your design with the specified CSV format." })],
    delayMs: 800,
  },

  // ==========================================================================
  // Phase M: Sub-agent with expandable conversation
  // ==========================================================================
  {
    messages: [m({ type: "text", content: "I'll delegate the export dialog implementation to a UI specialist sub-agent." })],
    delayMs: 600,
  },
  // Sub-agent starts with subagent messages (auto-expands, shows running)
  {
    messages: [
      m({ type: "tool_use", name: "Agent", toolUseId: "tool-sub-1", input: { description: "Implement ExportDialog component", subagent_type: "ui-engineer", prompt: "Create a modal dialog component for CSV export with: file name input, column selection checkboxes, date range filter, and download button." }, subagentId: "sub-ui-1", subagentMessages: [
        { id: "sub-1", type: "text", content: "I'll create the ExportDialog component with the requested features." },
        { id: "sub-2", type: "tool_use", name: "Write", toolUseId: "sub-tool-1", input: { file_path: "src/components/ExportDialog.tsx" } },
        { id: "sub-3", type: "tool_result", toolUseId: "sub-tool-1", output: "File created successfully" },
        { id: "sub-4", type: "tool_use", name: "Bash", toolUseId: "sub-tool-2", input: { command: "pnpm typecheck" } },
        { id: "sub-5", type: "tool_result", toolUseId: "sub-tool-2", output: "No errors found." },
        { id: "sub-6", type: "text", content: "ExportDialog component created with modal overlay, column checkboxes, date picker, and download trigger." },
      ] }),
    ],
    delayMs: 3000,
  },
  // Sub-agent completes
  {
    messages: [
      m({ type: "tool_result", toolUseId: "tool-sub-1", output: "Sub-agent completed.\n\nCreated: src/components/ExportDialog.tsx\n- Modal with backdrop blur\n- Column selection (all/none toggle)\n- Date range filter with calendar popover\n- CSV download with proper encoding\n\nTypecheck: passing" }),
    ],
    delayMs: 800,
  },

  // ==========================================================================
  // Phase N: Plan with mixed step statuses (progress display)
  // ==========================================================================
  {
    messages: [m({ type: "text", content: "Here's the current progress on our implementation plan:" })],
    delayMs: 600,
  },
  {
    messages: [m({ type: "plan", content: "Implementation progress update:", plan: {
      goal: "Full-stack user management dashboard with export and filtering",
      steps: [
        { id: "ps1", description: "Set up Zustand store with user state and actions", status: "completed" },
        { id: "ps2", description: "Create authentication flow (login/signup/logout)", status: "completed" },
        { id: "ps3", description: "Implement UserList with search and pagination", status: "completed" },
        { id: "ps4", description: "Add CreateUser/EditUser forms with Zod validation", status: "completed" },
        { id: "ps5", description: "Wire up Supabase real-time subscriptions", status: "completed" },
        { id: "ps6", description: "Add dark mode with theme toggle", status: "completed" },
        { id: "ps7", description: "Implement CSV export with column selection", status: "in_progress" },
        { id: "ps8", description: "Add date range filtering to UserList", status: "in_progress" },
        { id: "ps9", description: "Add Excel (.xlsx) export option", status: "failed" },
        { id: "ps10", description: "Add PDF report generation", status: "cancelled" },
        { id: "ps11", description: "Write integration tests for export flows", status: "pending" },
        { id: "ps12", description: "Performance optimization and bundle analysis", status: "pending" },
      ],
      notes: "Steps 9-10 were dropped due to scope change. Focusing on CSV export and filtering first.",
    } })],
    delayMs: 1000,
  },

  // ==========================================================================
  // Phase O: Edge cases — empty output, tool_use_error tag
  // ==========================================================================
  {
    messages: [
      m({ type: "tool_use", name: "Bash", toolUseId: "tool-edge-1", input: { command: "mkdir -p src/exports" } }),
      m({ type: "tool_result", toolUseId: "tool-edge-1", output: "" }),
    ],
    delayMs: 300,
  },
  {
    messages: [
      m({ type: "tool_use", name: "Bash", toolUseId: "tool-edge-2", input: { command: "npm publish --access=public" } }),
      m({ type: "tool_result", toolUseId: "tool-edge-2", output: "<tool_use_error>npm ERR! 403 Forbidden - You do not have permission to publish \"@viben/chat\". Are you logged in as the correct user?</tool_use_error>", isError: true }),
    ],
    delayMs: 500,
  },
  {
    messages: [m({ type: "text", content: "The publish failed due to permissions \u2014 that's expected since we haven't configured npm access yet. The directory was created successfully (empty output is normal for mkdir)." })],
    delayMs: 800,
  },
]
