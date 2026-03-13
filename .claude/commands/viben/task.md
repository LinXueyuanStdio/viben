# Start Session

Initialize your AI development session and begin working on tasks.

---

## Operation Types

| Marker | Meaning | Executor |
|--------|---------|----------|
| `[AI]` | Bash scripts or Task calls executed by AI | You (AI) |
| `[USER]` | Slash commands executed by user | User |

---

## Initialization `[AI]`

### Step 1: Understand Development Workflow

First, read the workflow guide to understand the development process:

```bash
cat .viben/workflow.md
```

**Follow the instructions in workflow.md** - it contains:
- Core principles (Read Before Write, Follow Standards, etc.)
- File system structure
- Development process
- Best practices

### Step 2: Get Current Context

```bash
viben task context <task>
```

This shows: developer identity, git status, task context (specs and patterns). It will also prompt you to read relevant guidelines.

### Step 3: Report and Ask

Report what you learned and ask: "What would you like to work on?"

---

## Task Classification

When user describes a task, classify it:

| Type | Criteria | Workflow |
|------|----------|----------|
| **Question** | User asks about code, architecture, or how something works | Answer directly |
| **Trivial Fix** | Typo fix, comment update, single-line change | Direct Edit |
| **Simple Task** | Clear goal, 1-2 files, well-defined scope | Quick confirm → Implement |
| **Complex Task** | Vague goal, multiple files, architectural decisions | **Brainstorm → Task Workflow** |

### Classification Signals

**Trivial/Simple indicators:**
- User specifies exact file and change
- "Fix the typo in X"
- "Add field Y to component Z"
- Clear acceptance criteria already stated

**Complex indicators:**
- "I want to add a feature for..."
- "Can you help me improve..."
- Mentions multiple areas or systems
- No clear implementation path
- User seems unsure about approach

### Decision Rule

> **If in doubt, use Brainstorm + Task Workflow.**
>
> Task Workflow ensures code-spec context is injected to agents, resulting in higher quality code.
> The overhead is minimal, but the benefit is significant.

---

## Question / Trivial Fix

For questions or trivial fixes, work directly:

1. Answer question or make the fix
2. If code was changed, remind user to run `/viben:finish-work`

---

## Simple Task

For simple, well-defined tasks:

1. Quick confirm: "I understand you want to [goal]. Ready to proceed?"
2. If yes, proceed to **Task Workflow Phase 1 Path B** (create task, write PRD, then research)
3. If no, clarify and confirm again

---

## Complex Task - Brainstorm First

For complex or vague tasks, use the brainstorm process to clarify requirements.

See `/viben:brainstorm` for the full process. Summary:

1. **Acknowledge and classify** - State your understanding
2. **Create task directory** - Track evolving requirements in `prd.md`
3. **Ask questions one at a time** - Update PRD after each answer
4. **Propose approaches** - For architectural decisions
5. **Confirm final requirements** - Get explicit approval
6. **Proceed to Task Workflow** - With clear requirements in PRD

### Key Brainstorm Principles

| Principle | Description |
|-----------|-------------|
| **One question at a time** | Never overwhelm with multiple questions |
| **Update PRD immediately** | After each answer, update the document |
| **Prefer multiple choice** | Easier for users to answer |
| **YAGNI** | Challenge unnecessary complexity |

---

## Task Workflow (Development Tasks)

**Why this workflow?**
- Research Agent analyzes what code-spec files are needed
- Code-spec files are configured in jsonl files
- Implement Agent receives code-spec context via Hook injection
- Check Agent verifies against code-spec requirements
- Result: Code that follows project conventions automatically

### Overview: Two Entry Points

```
From Brainstorm (Complex Task):
  PRD confirmed → Research → Configure Context → Activate → Implement → Check → Complete

From Simple Task:
  Confirm → Create Task → Write PRD → Research → Configure Context → Activate → Implement → Check → Complete
```

**Key principle: Research happens AFTER requirements are clear (PRD exists).**

---

### Phase 1: Establish Requirements

#### Path A: From Brainstorm (skip to Phase 2)

PRD and task directory already exist from brainstorm. Skip directly to Phase 2.

#### Path B: From Simple Task

**Step 1: Confirm Understanding** `[AI]`

Quick confirm:
- What is the goal?
- What type of development? (frontend / backend / fullstack)
- Any specific requirements or constraints?

**Step 2: Create Task Directory** `[AI]`

```bash
viben task create "<title>" --slug <name>
```

**Step 3: Write PRD** `[AI]`

Create `prd.md` in the task directory with:

```markdown
# <Task Title>

## Goal
<What we're trying to achieve>

## Requirements
- <Requirement 1>
- <Requirement 2>

## Acceptance Criteria
- [ ] <Criterion 1>
- [ ] <Criterion 2>

## Technical Notes
<Any technical decisions or constraints>
```

---

### Phase 2: Prepare for Implementation (shared)

> Both paths converge here. PRD and task directory must exist before proceeding.

**Step 4: Code-Spec Depth Check** `[AI]`

If the task touches infra or cross-layer contracts, do not start implementation until code-spec depth is defined.

Trigger this requirement when the change includes any of:
- New or changed command/API signatures
- Database schema or migration changes
- Infra integrations (storage, queue, cache, secrets, env contracts)
- Cross-layer payload transformations

Must-have before proceeding:
- [ ] Target code-spec files to update are identified
- [ ] Concrete contract is defined (signature, fields, env keys)
- [ ] Validation and error matrix is defined
- [ ] At least one Good/Base/Bad case is defined

**Step 5: Research the Codebase** `[AI]`

Based on the confirmed PRD, call Research Agent to find relevant specs and patterns:

```
Task(
  subagent_type: "research",
  prompt: "Analyze the codebase for this task:

  Task: <goal from PRD>

  Please find:
  1. Relevant code-spec files in docs/specs/
  2. Existing code patterns to follow (find 2-3 examples)
  3. Files that will likely need modification

  Output:
  ## Relevant Code-Specs
  - <path>: <why it's relevant>

  ## Code Patterns Found
  - <pattern>: <example file path>

  ## Files to Modify
  - <path>: <what change>",
  model: "opus"
)
```

**Step 6: Configure Context** `[AI]`

Initialize empty context files:

```bash
viben task init-context "$TASK_DIR"
```

Add code-spec files found by Research Agent:

```bash
# For each relevant code-spec and code pattern:
viben task add-context "$TASK_DIR" "<path>" -r "<reason>"
```

**Step 7: Activate Task** `[AI]`

```bash
viben task start "$TASK_DIR"
```

This starts task execution and spawns the agent.

---

### Phase 3: Execute (shared)

**Step 8: Implement** `[AI]`

Call Implement Agent (code-spec context is auto-injected by hook):

```
Task(
  subagent_type: "implement",
  prompt: "Implement the task described in prd.md.

  Follow all code-spec files that have been injected into your context.
  Run lint and typecheck before finishing.",
  model: "opus"
)
```

**Step 9: Check Quality** `[AI]`

Call Check Agent (code-spec context is auto-injected by hook):

```
Task(
  subagent_type: "check",
  prompt: "Review all code changes against the code-spec requirements.

  Fix any issues you find directly.
  Ensure lint and typecheck pass.",
  model: "opus"
)
```

**Step 10: Complete** `[AI]`

1. Verify lint and typecheck pass
2. Report what was implemented
3. Remind user to:
   - Test the changes
   - Commit when ready
   - Run `/viben:record-session` to record this session

---

## Continuing Existing Task

When a task directory is provided in the context below, this is an existing task. Execute it directly:

1. Run `viben task context <task>` to get task context
2. Read `prd.md` if it exists (optional - task may have requirements in task.json instead)
3. Check `task.json` for current status, phase, and requirements
4. **Do NOT ask for confirmation** - proceed directly with implementation
5. Resume from the appropriate phase based on task status:
   - If `status: backlog/queue` → Start from Phase 2 (Research)
   - If `status: in_progress` → Continue implementation
   - If `status: human_review` → Run check phase

---

## Commands Reference

### User Commands `[USER]`

| Command | When to Use |
|---------|-------------|
| `/viben:start` | Begin a session (this command) |
| `/viben:brainstorm` | Clarify vague requirements (called from start) |
| `/viben:parallel` | Complex tasks needing isolated worktree |
| `/viben:finish-work` | Before committing changes |
| `/viben:record-session` | After completing a task |

### AI Commands `[AI]`

| Command | Purpose |
|---------|---------|
| `viben task context <task>` | Get task context |
| `viben task create "<title>" --slug <name>` | Create task directory |
| `viben task init-context <task>` | Initialize empty jsonl files |
| `viben task add-context <task> <path> -r "<reason>"` | Add code-spec/context file to jsonl |
| `viben task start <task>` | Start task execution (serial mode) |
| `viben task plan-phase <task>` | Run Plan Agent (research + write prd) |
| `viben task work-phase <task>` | Run Dispatch Agent (implement → check → pr) |
| `viben task finish <task>` | Finish specified task |
| `viben task archive <task>` | Archive completed task |

### Sub Agents `[AI]`

| Agent | Purpose | Hook Injection |
|-------|---------|----------------|
| research | Analyze codebase | No (reads directly) |
| implement | Write code | Yes (implement.jsonl) |
| check | Review & fix | Yes (check.jsonl) |
| fix | Fix specific issues | Yes (fix.jsonl) |

---

## Key Principle

> **Code-spec context is injected, not remembered.**
>
> The Task Workflow ensures agents receive relevant code-spec context automatically.
> This is more reliable than hoping the AI "remembers" conventions.
