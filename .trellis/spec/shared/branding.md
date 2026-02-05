# Branding Guidelines

> Naming conventions for the Viben brand (formerly Browse MCP).

---

## Brand Names

| Context | Value | Notes |
|---------|-------|-------|
| **Brand Name** | Viben | User-visible, marketing, UI |
| **Technical Name** | browse-mcp | Package names, code identifiers (legacy) |
| **App Identifier** | com.viben.app | macOS/Windows bundle ID |
| **URL Scheme** | viben:// | Deep links |

---

## What Changes vs What Stays

### Must Change (User-Visible Brand)

All user-facing text should use "Viben":

| Location | Before | After |
|----------|--------|-------|
| App window title | Browse MCP | Viben |
| Sidebar title | Browse MCP | Viben |
| System tray tooltip | Browse MCP | Viben |
| Landing page headings | Browse MCP | Viben |
| Documentation site title | Browse MCP | Viben |
| Meta descriptions | Browse MCP | Viben |
| i18n title/footer strings | Browse MCP | Viben |
| Onboarding wizard | Browse MCP | Viben |
| Auth pages | Browse MCP | Viben |

### Keep As-Is (Technical Identifiers)

These remain unchanged for backward compatibility:

| Type | Value | Reason |
|------|-------|--------|
| PyPI package | `browse-mcp` | Published package, breaking change |
| Python module | `browse_mcp` | Import paths |
| MCP server key | `browse-mcp` | User configurations |

### Changes (Technical)

| Type | Before | After |
|------|--------|-------|
| npm scope | `@browse-mcp/*` | `@viben/*` |

### URL Changes

| Type | Before | After |
|------|--------|-------|
| GitHub repo | `github.com/LinXueyuanStdio/browse-mcp` | `github.com/LinXueyuanStdio/viben` |
| Vercel web app | `browse-mcp.vercel.app` | `viben-web.vercel.app` |
| Vercel docs | `browse-mcp-docs.vercel.app` | `viben-docs.vercel.app` |
| Landing page | `linxueyuan.online/browse-mcp/` | `linxueyuan.online/viben/` |

> **Note**: GitHub URL change affects 50+ file references (READMEs, docs, package.json, workflows).

### Migrate Gradually (App-Specific)

These should be updated but require careful migration:

| Type | Before | After | Migration Path |
|------|--------|-------|----------------|
| App identifier | `com.browsemcp.app` | `com.viben.app` | Next major release |
| URL scheme | `browsemcp://` | `viben://` | Support both temporarily |
| Config directory | `~/.browsemcp/` | `~/.viben/` | Auto-migrate on startup |
| LocalStorage keys | `browse-mcp-*` | `viben-*` | Auto-migrate on startup |

---

## File-by-File Reference

### Desktop App (Tauri)

| File | Changes |
|------|---------|
| `apps/desktop/src-tauri/tauri.conf.json` | `productName`, `title`, `identifier`, `schemes` |
| `apps/desktop/src-tauri/Cargo.toml` | `description` |
| `apps/desktop/src-tauri/src/lib.rs` | Tray tooltip |
| `apps/desktop/src-tauri/src/commands/tray.rs` | Tray tooltips |
| `apps/desktop/src-tauri/src/commands/auth.rs` | OAuth callback URL |

### Desktop App (React)

| File | Changes |
|------|---------|
| `apps/desktop/src/components/layout/sidebar.tsx` | Sidebar title |
| `apps/desktop/src/components/onboarding/*.tsx` | Onboarding text |
| `apps/desktop/src/stores/app-store.ts` | Storage key |
| `apps/desktop/src/stores/auth-store.ts` | Storage key |
| `apps/desktop/src/i18n/locales/*.json` | All locale files (18+) |
| `apps/desktop/index.html` | Title, localStorage key |

### Web App

| File | Changes |
|------|---------|
| `apps/web/app/layout.tsx` | Metadata title |
| `apps/web/app/page.tsx` | Page title |
| `apps/web/app/(auth)/layout.tsx` | Auth layout title |
| `apps/web/app/(auth)/register/page.tsx` | Register page text |
| `apps/web/components/layout/sidebar.tsx` | Sidebar title |

### Landing Page

| File | Changes |
|------|---------|
| `apps/landingpage/index.html` | All occurrences (title, meta, headings, footer) |
| `apps/landingpage/assets/style.css` | Comment header |

### Documentation

| File | Changes |
|------|---------|
| `apps/docs/docusaurus.config.ts` | Site title, navbar, footer |
| `apps/docs/package.json` | Description |
| `apps/docs/blog/authors.yml` | Team name |
| `apps/docs/src/pages/index.tsx` | Hero content |
| `apps/docs/docs/**/*.md` | All doc content |
| `apps/docs/i18n/**/*.json` | Navbar/footer translations |

### Other

| File | Changes |
|------|---------|
| `provider.index.json` | Provider display name |

---

## i18n Keys to Update

These keys appear in all locale files:

```json
{
  "title": "Browse MCP",  // → "Viben"
  "footer": "Browse MCP - Your AI-powered research assistant"  // → "Viben - ..."
}
```

Locale files (18 total):
- `en.json`, `zh-CN.json`, `es.json`, `fr.json`, `de.json`
- `ja.json`, `ko.json`, `it.json`, `pt.json`, `ru.json`
- `nl.json`, `pl.json`, `sv.json`, `tr.json`, `th.json`
- `uk.json`, `vi.json`, `id.json`, `ms.json`, `hi.json`

---

## Implementation Phases

### Phase 1: Brand Text (Low Risk)
Update all user-visible strings to "Viben".
- i18n files
- Sidebar titles
- Window titles
- Landing page
- Documentation

### Phase 2: App Identity (Medium Risk)
Update app identifiers. Requires app reinstall.
- `tauri.conf.json` identifier
- URL scheme
- Tray tooltips

### Phase 3: Storage Migration (Medium Risk)
Add migration logic for user data.
- LocalStorage keys
- Config directory paths

### Phase 4: Package Names (High Risk - Deferred)
Only if needed. Breaking change for users.
- npm packages
- PyPI packages

---

## Code Examples

### Good: Brand in UI

```typescript
// Sidebar title
<span className="font-semibold">Viben</span>

// Meta description
<meta name="description" content="Viben - Search, download academic papers" />

// Tray tooltip
.tooltip("Viben")
```

### Good: Technical identifier (unchanged)

```typescript
// Package import (unchanged)
import { BrowseMcpClient } from '@browse-mcp/api-client';

// MCP server config (unchanged)
"browse-mcp": {
  "command": "uvx",
  "args": ["browse-mcp"]
}
```

### Migration: Storage keys

```typescript
// Auto-migrate localStorage
const OLD_KEY = 'browse-mcp-storage';
const NEW_KEY = 'viben-storage';

const oldData = localStorage.getItem(OLD_KEY);
if (oldData && !localStorage.getItem(NEW_KEY)) {
  localStorage.setItem(NEW_KEY, oldData);
  localStorage.removeItem(OLD_KEY);
}
```

---

## Tagline Options

Consider updating the tagline alongside the brand:

| Current | Options |
|---------|---------|
| "Academic Paper Search with MCP Integration" | "AI-Powered Research Assistant" |
| "Your AI-powered research assistant" | "Search. Discover. Create." |
| "Browse MCP Desktop" | "Viben Desktop" |

---

## Checklist

Before merging rebranding changes:

- [ ] All user-visible "Browse MCP" → "Viben"
- [ ] Window title updated
- [ ] Tray tooltip updated
- [ ] All 18 locale files updated
- [ ] Landing page updated
- [ ] Documentation site updated
- [ ] Web app updated
- [ ] App identifier updated (if doing Phase 2)
- [ ] Storage migration added (if doing Phase 3)
- [ ] Test app launch and basic flows
- [ ] Test system tray functionality
- [ ] Test deep links (if scheme changed)

---

**Last Updated**: 2026-02-05
