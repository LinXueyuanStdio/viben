# Marketplace Publish Flow

> Specification for "Publish My MCP" and "Publish My Skill" features in the marketplace pages.

---

## Overview

Both MCP Market and Skills Market pages should have a publish button in the top-right corner (visible only when logged in). Clicking the button navigates to a multi-step publish wizard.

---

## Entry Points

### MCP Market (`/mcp-market`)

| Element | Specification |
|---------|---------------|
| Button Text | "Publish My MCP" |
| Position | Top-right corner of page header |
| Visibility | Only when user is authenticated |
| Navigation | `/mcp-market/publish` |

### Skills Market (`/skills-market`)

| Element | Specification |
|---------|---------------|
| Button Text | "Publish My Skill" |
| Position | Top-right corner of page header |
| Visibility | Only when user is authenticated |
| Navigation | `/skills-market/publish` |

---

## MCP Publish Flow

### Flow Steps

```
Step 1: Basic Info → Step 2: Code/Config → Step 3: Preview → Step 4: Publish
```

### Step 1: Basic Info

Required fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Name | text | Yes | MCP package name |
| Description | textarea | Yes | Short description (max 280 chars) |
| Icon | file upload | Yes | Square image (recommended 512x512) |
| Category | select | Yes | Primary category |
| Tags | multi-select | No | Up to 5 tags |
| Version | text | Yes | Semantic version (e.g., 1.0.0) |
| License | select | Yes | MIT, Apache-2.0, GPL-3.0, etc. |
| Homepage | url | No | Project homepage or repository |

### Step 2: Code/Config

- Upload MCP configuration files
- Define entry points and commands
- Specify dependencies and requirements

### Step 3: Preview

- Show how the MCP will appear in the marketplace
- Display all metadata in card format
- Allow editing (go back to previous steps)

### Step 4: Publish

- Final confirmation
- Terms of service agreement
- Submit for review or publish immediately

---

## Skill Publish Flow

### Flow Steps

```
Step 1: Import Source → Step 2: Edit → Step 3: Preview → Step 4: Publish
```

### Step 1: Import Source

Three import methods available:

#### Type 1: Upload ZIP Files

| Specification | Details |
|---------------|---------|
| Input | Multiple ZIP file selection |
| Validation | Each ZIP must contain `SKILL.md` at root |
| UI | Drag-and-drop zone + file browser |
| Feedback | Show validation status for each file |

#### Type 2: Select Local Directories

| Specification | Details |
|---------------|---------|
| Input | Directory picker (multiple selection) |
| Validation | Each directory must contain `SKILL.md` at root |
| UI | Folder browser with checkboxes |
| Feedback | Show validation status for each directory |

#### Type 3: Import from GitHub

| Specification | Details |
|---------------|---------|
| Auth | Connect GitHub account (OAuth) |
| Step 1 | List user's repositories |
| Step 2 | Select repository |
| Detection | Auto-detect `skills/` folder or root-level `SKILL.md` |
| Step 3 | List available skills with checkboxes |
| Selection | Multiple skill selection supported |

### Step 2: Edit

For each imported skill:

- Preview `SKILL.md` content
- Edit metadata (name, description, tags)
- Add/modify examples
- Configure visibility (public/private)

### Step 3: Preview

- Show how each skill will appear in marketplace
- Display skill card preview
- Allow batch review of multiple skills

### Step 4: Publish

- Final confirmation for all selected skills
- Terms of service agreement
- Publish all or select individual skills

---

## Auto-Save (Draft Mode)

| Feature | Specification |
|---------|---------------|
| Trigger | Auto-save on field change (debounced 2s) |
| Storage | Local storage + backend sync when online |
| Resume | Show "Continue draft?" prompt on return |
| Expiry | Drafts expire after 30 days |
| Indicator | Show "Draft saved" toast notification |

---

## UI Components

### Progress Indicator

```
[1] ─── [2] ─── [3] ─── [4]
 ●      ○       ○       ○
Basic  Config  Preview Publish
```

- Numbered steps with connecting lines
- Current step highlighted
- Completed steps show checkmark
- Clickable to navigate (if step is accessible)

### Navigation Buttons

| Position | Buttons |
|----------|---------|
| Bottom-left | "Back" (disabled on step 1) |
| Bottom-right | "Continue" / "Publish" (on final step) |
| Top-right | "Save Draft" / "Cancel" |

### Validation

- Inline validation on field blur
- Step completion validation before proceeding
- Show all errors at top of step if submit fails

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Upload fails | Show retry button, keep other uploads |
| GitHub auth fails | Show re-auth option, preserve selections |
| Validation error | Highlight fields, scroll to first error |
| Network error | Auto-retry with exponential backoff |
| Draft save fails | Show warning, offer manual save |

---

## Routes

```
/mcp-market/publish           # MCP publish wizard
/mcp-market/publish/:draftId  # Resume draft

/skills-market/publish           # Skill publish wizard
/skills-market/publish/:draftId  # Resume draft
```

---

## Implementation Checklist

### Phase 1: Foundation
- [ ] Add publish button to MCP Market page header
- [ ] Add publish button to Skills Market page header
- [ ] Create route structure for publish pages
- [ ] Implement auth check for button visibility

### Phase 2: MCP Publish
- [ ] Step 1: Basic info form
- [ ] Step 2: Code/config upload
- [ ] Step 3: Preview component
- [ ] Step 4: Publish confirmation
- [ ] Auto-save functionality

### Phase 3: Skill Publish
- [ ] Step 1a: ZIP file upload with validation
- [ ] Step 1b: Directory selection with validation
- [ ] Step 1c: GitHub OAuth integration
- [ ] Step 1c: Repository browser
- [ ] Step 1c: Skill detection and selection
- [ ] Step 2: Skill editor
- [ ] Step 3: Batch preview
- [ ] Step 4: Batch publish

### Phase 4: Polish
- [ ] Progress indicator animation
- [ ] Transition animations between steps
- [ ] Loading states
- [ ] Error recovery flows
- [ ] Mobile responsiveness

---

## Design Notes

Follow the [Design System](../core/design-system.md):

- Use warm amber palette for primary actions
- Serif typography for headings
- Staggered animations on step transitions
- Card-based preview matching marketplace card design
