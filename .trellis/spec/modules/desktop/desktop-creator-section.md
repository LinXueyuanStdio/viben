# Desktop Creator Section

> **Status**: Specification
> **Priority**: P1
> **Platform**: Desktop only (apps/desktop)

---

## Overview

Add a "Creator" (创作者) section to the desktop app sidebar, mirroring the web app's creator functionality. This section is **only visible for logged-in users** and provides access to publishing, package management, and analytics features.

---

## Requirements

### 1. Sidebar Creator Section

Add a new collapsible section in the sidebar between Skills and bottom area:

| Item | Icon | Route | Description |
|------|------|-------|-------------|
| Publish | `Upload` | `/publish` | Package publish wizard |
| My Packages | `PackageSearch` | `/my-packages` | User's published packages |
| Analytics | `BarChart3` | `/analytics` | Download statistics |

**Visibility**: Only when `isAuthenticated === true`

### 2. Translation Keys

Add to `en.json` and `zh-CN.json`:

```json
{
  "creator": {
    "title": "Creator",
    "publish": "Publish",
    "myPackages": "My Packages",
    "analytics": "Analytics"
  }
}
```

```json
{
  "creator": {
    "title": "创作者",
    "publish": "发布",
    "myPackages": "我的包",
    "analytics": "数据分析"
  }
}
```

### 3. Pages to Create

Since desktop is a local app, Creator pages will interact with the web API:

| Page | Purpose |
|------|---------|
| `publish.tsx` | Redirect to web publish or show publish flow |
| `my-packages.tsx` | List user's published packages from web API |
| `analytics.tsx` | Show download/favorite statistics from web API |

---

## Implementation

### Sidebar Component Changes

**File**: `apps/desktop/src/components/layout/sidebar.tsx`

```tsx
// Add navigation items
const creatorNav: NavItem[] = [
  { titleKey: "creator.publish", href: "/publish", icon: Upload },
  { titleKey: "creator.myPackages", href: "/my-packages", icon: PackageSearch },
  { titleKey: "creator.analytics", href: "/analytics", icon: BarChart3 },
];

// In sidebar JSX, add after Skills section:
{isAuthenticated && (
  <SidebarSection
    title={t("creator.title")}
    collapsible
    defaultOpen
  >
    <nav className="flex flex-col gap-1">
      {creatorNav.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          className={({ isActive }) =>
            cn(navLinkStyles, isActive && "bg-accent text-accent-foreground")
          }
        >
          <item.icon className="h-4 w-4" />
          <span>{t(item.titleKey)}</span>
        </NavLink>
      ))}
    </nav>
  </SidebarSection>
)}
```

### Collapsed Mode Support

In collapsed mode, show icon buttons with tooltips:

```tsx
{isAuthenticated && creatorNav.map((item) => (
  <SidebarIconButton
    key={item.href}
    icon={item.icon}
    label={t(item.titleKey)}
    href={item.href}
  />
))}
```

---

## API Integration

Creator pages need to call web API endpoints:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/users/me/packages` | List user's packages |
| `GET /api/users/me/favorites` | List favorites |
| `GET /api/analytics/downloads` | Download statistics |

Use existing `useAuth` hook to get authentication token for API calls.

---

## Design Notes

### Follow Existing Patterns

1. **Section styling**: Match MCP and Skills sections
2. **Icon consistency**: Use lucide-react icons
3. **Collapse behavior**: Support collapsed/expanded states
4. **Active state**: Highlight current page with accent color

### Authentication Flow

- Check `isAuthenticated` from `useAuth()` hook
- If not logged in, section is completely hidden
- No "login to see" placeholder - just hide the section

---

## Acceptance Criteria

- [ ] Creator section appears in sidebar when logged in
- [ ] Creator section hidden when not logged in
- [ ] All three navigation items (Publish, My Packages, Analytics) work
- [ ] Collapsed mode shows icons with tooltips
- [ ] Expanded mode shows full labels
- [ ] Translation keys work for en and zh-CN
- [ ] Section is collapsible with persistent state

---

## Related

- [Web Creator Section](../../frontend/features/marketplace-publish-flow.md)
- [Publish UI Spec](../marketplace/publish-ui.md)
- [Analytics UI Spec](../admin/analytics-ui.md)
- [Desktop Integration](./desktop-integration.md)
