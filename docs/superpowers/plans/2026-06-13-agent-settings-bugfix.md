# Agent Settings Bugfix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix agent orchestration settings page: replace approval boolean with 3-option segmented button, remove plan mode, rewrite MCP dialog with inline editor + marketplace, rewrite Skill dialog with embedded marketplace.

**Architecture:** Three independent changes executed sequentially. Task 1 modifies core types and executor config UI. Tasks 2-4 rewrite the MCP dialog with a new inline editor and marketplace integration. Tasks 5-6 rewrite the Skill dialog with embedded marketplace grid.

**Tech Stack:** React, TypeScript, Tailwind CSS, @viben/ui components, existing marketplace hooks (useOfficialRegistry, useCloudMcp, useCloudSkillPackages)

---

## File Structure

### New Files

| Path | Responsibility |
|------|---------------|
| `apps/desktop/src/components/agent/mcp-config-editor.tsx` | Inline JSON/Rich toggle editor for MCP servers |
| `apps/desktop/src/components/agent/mcp-server-config-dialog.tsx` | Sub-dialog for configuring a single MCP server's connection params |
| `apps/desktop/src/components/agent/mcp-market-list.tsx` | Reusable MCP marketplace grid with search, categories, and add button |
| `apps/desktop/src/components/agent/skill-market-grid.tsx` | Reusable skill marketplace grid with search, categories, and toggle |

### Modified Files

| Path | Changes |
|------|---------|
| `packages/core/src/agents/types.ts` | Remove `planMode`, `approvals`; add `approval_mode` |
| `packages/core/src/acp/types.ts` | Remove `plan_mode`, `approvals`; add `approval_mode` |
| `packages/core/src/executors/ops/types.ts` | Remove `planMode`, `approvals`; add `approvalMode` |
| `packages/core/src/executors/engines/claude.ts` | Use `approvalMode` to decide CLI args |
| `apps/desktop/src/components/agent/agent-config-panel.tsx` | Replace plan/approval switches with segmented button; replace MCP list with McpConfigEditor |
| `apps/desktop/src/components/agent/agent-settings-tab.tsx` | Update prop forwarding |
| `apps/desktop/src/components/agent/agent-mcp-dialog.tsx` | Complete rewrite: Built-in + Market tabs |
| `apps/desktop/src/components/agent/agent-skills-dialog.tsx` | Complete rewrite: single-page marketplace + local path |
| `apps/desktop/src/pages/agents/agent-detail.tsx` | Adapt state management to new props |
| `apps/desktop/src/lib/gateway/types/agent.ts` | Update `AgentMcpEntry` type if needed |

---

### Task 1: Core Types & Executor Config — ApprovalMode

**Files:**
- Modify: `packages/core/src/agents/types.ts:26-55`
- Modify: `packages/core/src/acp/types.ts:180-195`
- Modify: `packages/core/src/executors/ops/types.ts:293-301`
- Modify: `packages/core/src/executors/engines/claude.ts` (approval logic)

- [ ] **Step 1: Update AgentConfigFile in agents/types.ts**

Remove `planMode?: boolean` (line 39) and `approvals?: boolean` (line 40). Add `approval_mode?: "bypass" | "rules" | "ai"` field.

- [ ] **Step 2: Update AgentConfigPayload in acp/types.ts**

Remove `plan_mode?: boolean` (line 191) and `approvals?: boolean` (line 192). Add `approval_mode?: "bypass" | "rules" | "ai"`.

- [ ] **Step 3: Update ExecutorConfig in executors/ops/types.ts**

Remove `planMode?: boolean` (line 296) and `approvals?: boolean` (line 297). Add `approvalMode?: "bypass" | "rules" | "ai"`.

- [ ] **Step 4: Update ClaudeExecutor in executors/engines/claude.ts**

Change the condition `if (this.config.planMode || this.config.approvals)` to check `this.config.approvalMode`. When `approvalMode === "bypass"`, add `--dangerously-skip-permissions`. When `approvalMode === "rules"`, add `--permission-prompt-tool stdio --permission-mode default`. When `approvalMode === "ai"`, add `--permission-prompt-tool stdio --permission-mode auto`.

- [ ] **Step 5: Fix all TypeScript compile errors in packages/core**

Run `pnpm --filter @viben/core typecheck` and fix any remaining references to `planMode` or `approvals` in the core package.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/agents/types.ts packages/core/src/acp/types.ts packages/core/src/executors/ops/types.ts packages/core/src/executors/engines/claude.ts
git commit -m "refactor(core): replace planMode/approvals with approval_mode enum"
```

---

### Task 2: Desktop UI — ApprovalMode Segmented Button

**Files:**
- Modify: `apps/desktop/src/components/agent/agent-config-panel.tsx:68-124` (props), `397-415` (UI)
- Modify: `apps/desktop/src/components/agent/agent-settings-tab.tsx:155-156,169-170,265-270`
- Modify: `apps/desktop/src/pages/agents/agent-detail.tsx` (state management)

- [ ] **Step 1: Update AgentConfigPanelProps**

In `agent-config-panel.tsx`, remove `planMode`, `approvals`, `onPlanModeChange`, `onApprovalsChange` from props interface. Add:
```
approvalMode: "bypass" | "rules" | "ai";
onApprovalModeChange: (mode: "bypass" | "rules" | "ai") => void;
```

- [ ] **Step 2: Replace the Claude Code Options UI block**

Replace the current Switch-based block (lines 397-415) with a segmented button matching the `context-settings-popup.tsx` style. The block title changes to "执行器选项". Three buttons: ShieldOff + "绕过审批", ShieldCheck + "规则审批", ShieldAlert + "AI 审批". Container: `h-8 rounded-md border overflow-hidden flex`. Active: `bg-accent text-accent-foreground font-medium`. Inactive: `text-muted-foreground hover:bg-muted hover:text-foreground`.

- [ ] **Step 3: Update agent-settings-tab.tsx**

Remove `planMode`, `approvals`, `onPlanModeChange`, `onApprovalsChange` from destructured props and forwarded props. Add `approvalMode`, `onApprovalModeChange`.

- [ ] **Step 4: Update agent-detail.tsx state management**

Replace `const [planMode, setPlanMode] = useState(false)` and `const [approvals, setApprovals] = useState(false)` with `const [approvalMode, setApprovalMode] = useState<"bypass" | "rules" | "ai">("rules")`. Load from agent config's `approval_mode` field. Pass to child components.

- [ ] **Step 5: Fix any remaining compile errors in apps/desktop**

Run `pnpm --filter viben-desktop typecheck` and fix remaining references.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/components/agent/agent-config-panel.tsx apps/desktop/src/components/agent/agent-settings-tab.tsx apps/desktop/src/pages/agents/agent-detail.tsx
git commit -m "feat(desktop): replace plan/approval switches with approval_mode segmented button"
```

---

### Task 3: McpConfigEditor — Inline JSON/Rich Editor

**Files:**
- Create: `apps/desktop/src/components/agent/mcp-config-editor.tsx`
- Modify: `apps/desktop/src/components/agent/agent-config-panel.tsx` (capabilities section)

- [ ] **Step 1: Create McpConfigEditor component**

Create `apps/desktop/src/components/agent/mcp-config-editor.tsx`. Props:
```
interface McpConfigEditorProps {
  servers: AgentMcpEntry[];
  onServersChange: (servers: AgentMcpEntry[]) => void;
  onOpenDialog: () => void;
  className?: string;
}
```

Component has two modes toggled by a `[JSON] [Rich]` button pair at the top:
- **JSON mode**: A `<Textarea>` showing the full JSON (`{ "mcpServers": { ... } }`). On change, parse and call `onServersChange`. Show parse errors inline.
- **Rich mode**: A list of `AgentMcpEntry` items, each showing name, type badge, and a delete (×) button.

Include a `[配置]` button at the top-right that calls `onOpenDialog`.

Use bidirectional sync: derive JSON from `servers` prop; parse JSON to derive entries.

- [ ] **Step 2: Replace MCP section in agent-config-panel.tsx**

In the capabilities section (around line 487-536), replace the current server list and configure button with `<McpConfigEditor servers={selectedMcpServers} onServersChange={...} onOpenDialog={onConfigureMcp} />`. Remove `onRemoveMcpServer` prop (now handled internally by the editor).

- [ ] **Step 3: Verify typecheck passes**

Run `pnpm --filter viben-desktop typecheck`.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/agent/mcp-config-editor.tsx apps/desktop/src/components/agent/agent-config-panel.tsx
git commit -m "feat(desktop): add McpConfigEditor with JSON/Rich toggle"
```

---

### Task 4: MCP Dialog Rewrite — Built-in + Market + Config Sub-dialog

**Files:**
- Create: `apps/desktop/src/components/agent/mcp-market-list.tsx`
- Create: `apps/desktop/src/components/agent/mcp-server-config-dialog.tsx`
- Rewrite: `apps/desktop/src/components/agent/agent-mcp-dialog.tsx`

- [ ] **Step 1: Create McpMarketList component**

Create `apps/desktop/src/components/agent/mcp-market-list.tsx`. This wraps the marketplace browsing UI for use inside a dialog. Props:
```
interface McpMarketListProps {
  onAdd: (serverName: string, pkg: OfficialPackage) => void;
  className?: string;
}
```

Internally uses `useOfficialRegistry` hook (same as `marketplace.tsx`). Renders:
- `SearchBar` from `@/components/marketplace`
- `CategoryFilter` from `@/components/marketplace`
- Grid of `OfficialServerCard` from `@/components/marketplace`, with the `onInstall` prop wired to call `onAdd(server.name, server.package)`.

Also shows `useCloudMcp` packages below official ones if available (using `PackageCard`).

- [ ] **Step 2: Create McpServerConfigDialog component**

Create `apps/desktop/src/components/agent/mcp-server-config-dialog.tsx`. Props:
```
interface McpServerConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverName: string;
  initialConfig?: Partial<AgentMcpEntry>;
  onConfirm: (entry: AgentMcpEntry) => void;
}
```

Dialog content:
- Transport type select (default: "http" for streamable HTTP)
- URL input (pre-filled from `initialConfig.url` if available)
- Headers key-value editor (same `KeyValueEditor` pattern as current `agent-mcp-dialog.tsx`)
- A toggle to switch to raw JSON editing mode
- "确认添加" button that constructs an `AgentMcpEntry` and calls `onConfirm`

- [ ] **Step 3: Rewrite AgentMcpDialog**

Completely rewrite `apps/desktop/src/components/agent/agent-mcp-dialog.tsx`. New structure:

Props stay the same:
```
interface AgentMcpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedServers: AgentMcpEntry[];
  onServersChange: (servers: AgentMcpEntry[]) => void;
}
```

Two tabs: "Built-in" and "Market".

**Built-in tab**: Hard-coded list of built-in MCP servers (browse-mcp gateway proxy, client-side MCP). Each has an "添加" button that directly appends to `localSelected`.

**Market tab**: Renders `<McpMarketList onAdd={handleMarketAdd} />`. When user clicks add on a market card, open `McpServerConfigDialog` with pre-filled data from the package. On confirm, add the entry to `localSelected`.

Footer: Cancel + Save buttons (same pattern as current dialog).

- [ ] **Step 4: Update imports and remove dead code**

Remove old imports that are no longer needed (parseMcpConfigAll, validateMcpConfig, useGatewayInspector, Client, StreamableHTTPClientTransport, etc.). Remove the old `ParsedServerCard`, `ToolCard`, `KeyValueEditor` from the dialog file (KeyValueEditor can be kept if extracted to a shared util, or reimplemented inline in the new config dialog).

- [ ] **Step 5: Verify typecheck and test manually**

Run `pnpm --filter viben-desktop typecheck`.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/components/agent/mcp-market-list.tsx apps/desktop/src/components/agent/mcp-server-config-dialog.tsx apps/desktop/src/components/agent/agent-mcp-dialog.tsx
git commit -m "feat(desktop): rewrite MCP dialog with Built-in + Market tabs and config sub-dialog"
```

---

### Task 5: SkillMarketGrid — Reusable Skill Grid Component

**Files:**
- Create: `apps/desktop/src/components/agent/skill-market-grid.tsx`

- [ ] **Step 1: Create SkillMarketGrid component**

Create `apps/desktop/src/components/agent/skill-market-grid.tsx`. Props:
```
interface SkillMarketGridProps {
  selectedIds: string[];
  onToggle: (skillId: string) => void;
  className?: string;
}
```

Internally uses `useCloudSkillPackages()` and `useCloudSkillCategories()` hooks (same as `skills-market.tsx`). Renders:
- `SearchBar` from `@/components/skills`
- `CategoryFilter` from `@/components/skills`
- Grid of skill cards (use existing `SkillCard` from `@/components/skills` but adapt the `onViewDetails`/`onInstall` props to act as a toggle). Each card shows a selected state (border-primary + check icon overlay) when its ID is in `selectedIds`. Clicking toggles selection via `onToggle`.

Use a search filter and category filter like the existing `skills-market.tsx` page does.

- [ ] **Step 2: Verify typecheck**

Run `pnpm --filter viben-desktop typecheck`.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/agent/skill-market-grid.tsx
git commit -m "feat(desktop): add SkillMarketGrid reusable component"
```

---

### Task 6: Skill Dialog Rewrite — Single Page with Marketplace + Local Path

**Files:**
- Rewrite: `apps/desktop/src/components/agent/agent-skills-dialog.tsx`

- [ ] **Step 1: Rewrite AgentSkillsDialog**

Completely rewrite `apps/desktop/src/components/agent/agent-skills-dialog.tsx`. Props stay the same:
```
interface AgentSkillsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSkillIds: string[];
  onSkillsChange: (skillIds: string[]) => void;
  workspacePath?: string;
}
```

Single-page layout (no tabs):

**Upper section**: `<SkillMarketGrid selectedIds={localSelected} onToggle={handleToggle} />` — full marketplace with search and categories.

**Lower section** (with a separator label "Local Path"): 
- Input + Browse button + Add button (reuse logic from current Local Path tab)
- List of added local paths with delete buttons

Footer: Cancel + Save buttons.

- [ ] **Step 2: Remove unused imports**

Remove `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` imports. Remove `BUILTIN_SKILLS` constant. Remove the old marketplace list rendering logic (now delegated to SkillMarketGrid).

- [ ] **Step 3: Verify typecheck**

Run `pnpm --filter viben-desktop typecheck`.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/agent/agent-skills-dialog.tsx
git commit -m "feat(desktop): rewrite skill dialog with embedded marketplace grid + local path"
```

---

### Task 7: Final Cleanup & Integration Test

**Files:**
- Modify: various (fix any remaining references)

- [ ] **Step 1: Full typecheck across workspace**

Run `pnpm typecheck` from workspace root. Fix any remaining type errors across `packages/core`, `apps/desktop`, or other packages that reference the removed fields.

- [ ] **Step 2: Search for dead references**

```bash
grep -rn "planMode\|plan_mode\|onPlanModeChange" apps/desktop/src packages/core/src --include="*.ts" --include="*.tsx"
grep -rn "onApprovalsChange" apps/desktop/src --include="*.ts" --include="*.tsx"
```

Remove any remaining dead code.

- [ ] **Step 3: Verify build**

Run `pnpm build` from workspace root to ensure all packages compile.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: final cleanup — remove dead planMode/approvals references"
```
